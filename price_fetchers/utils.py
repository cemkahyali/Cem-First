"""Helper utilities for retrieving and parsing retailer pages."""

from __future__ import annotations

import json
import logging
import re
import warnings
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from requests.exceptions import SSLError
from urllib3.exceptions import InsecureRequestWarning

logger = logging.getLogger(__name__)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}
REQUEST_TIMEOUT = 30

PRICE_REGEX = re.compile(r"(\d+[.,]\d+|\d+)\s*(?:TL|₺|TRY|Lira)?", re.IGNORECASE)


class FetchError(RuntimeError):
    """Raised when the HTTP request fails or the response is empty."""


@dataclass
class JsonLdProduct:
    name: Optional[str]
    price: Optional[float]
    currency: Optional[str]
    url: Optional[str]
    raw_price_text: Optional[str]


def fetch_html(
    url: str,
    *,
    params: Optional[Dict[str, str]] = None,
    allow_insecure_ssl: bool = False,
    headers: Optional[Dict[str, str]] = None,
    include_default_headers: bool = True,
) -> Tuple[str, str]:
    """Retrieve HTML from a URL returning the response text and final URL."""

    request_headers: Dict[str, str] = {}
    if include_default_headers:
        request_headers.update(DEFAULT_HEADERS)
    if headers:
        request_headers.update(headers)

    request_kwargs = {
        "headers": request_headers,
        "params": params,
        "timeout": REQUEST_TIMEOUT,
        "verify": True,
    }

    try:
        response = requests.get(url, **request_kwargs)
        response.raise_for_status()

        # Try to handle encoding issues
        if response.encoding == "ISO-8859-1":
            response.encoding = "utf-8"

        # Force UTF-8 encoding for Turkish content
        try:
            response.encoding = "utf-8"
        except:
            pass

    except SSLError as ssl_exc:
        if not allow_insecure_ssl:
            raise FetchError(str(ssl_exc)) from ssl_exc

        logger.warning("SSL verification failed for %s; retrying without certificate validation", url)
        request_kwargs["verify"] = False
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", InsecureRequestWarning)
                response = requests.get(url, **request_kwargs)
            response.raise_for_status()

            if response.encoding == "ISO-8859-1":
                response.encoding = "utf-8"
            try:
                response.encoding = "utf-8"
            except:
                pass
        except requests.RequestException as exc:  # pragma: no cover - network issues are runtime concerns
            raise FetchError(str(exc)) from exc

    except requests.RequestException as exc:  # pragma: no cover - network issues are runtime concerns
        raise FetchError(str(exc)) from exc

    if not response.text:
        raise FetchError("Empty response body")

    return response.text, response.url


def parse_price(text: str) -> Optional[float]:
    """Normalise price text (Turkish Lira) to a float."""

    if not text:
        return None

    match = PRICE_REGEX.search(text.replace("\xa0", " "))
    if not match:
        return None

    numeric = match.group(1).replace(".", "").replace(",", ".")
    try:
        return float(numeric)
    except ValueError:
        return None


def parse_json_ld_products(html: str) -> List[JsonLdProduct]:
    """Extract product information from JSON-LD blocks when available."""

    soup = BeautifulSoup(html, "html.parser")
    products: List[JsonLdProduct] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
        except json.JSONDecodeError:
            continue
        for item in _iter_json_items(data):
            product = _extract_product_from_json(item)
            if product:
                products.append(product)
    return products


def _iter_json_items(data: Any) -> Iterator[Any]:
    """Yield every element from arbitrarily nested JSON data."""

    if isinstance(data, dict):
        yield data
        for value in data.values():
            yield from _iter_json_items(value)
    elif isinstance(data, list):
        for value in data:
            yield from _iter_json_items(value)


def _extract_product_from_json(item: Any) -> Optional[JsonLdProduct]:
    """Create a JsonLdProduct when the JSON entry resembles a product."""

    if not isinstance(item, dict):
        return None

    types = item.get("@type")
    if isinstance(types, list):
        types = [value.lower() for value in types if isinstance(value, str)]
    elif isinstance(types, str):
        types = [types.lower()]
    else:
        types = []

    if "product" not in types:
        return None

    offers = item.get("offers")
    price_text = None
    currency = None
    if isinstance(offers, dict):
        price_text = offers.get("price") or offers.get("priceSpecification", {}).get("price")
        currency = offers.get("priceCurrency") or offers.get("priceSpecification", {}).get("priceCurrency")
    elif isinstance(offers, list):
        for offer in offers:
            if isinstance(offer, dict) and (offer.get("price") or offer.get("priceSpecification")):
                price_text = offer.get("price") or offer.get("priceSpecification", {}).get("price")
                currency = offer.get("priceCurrency") or offer.get("priceSpecification", {}).get("priceCurrency")
                break

    numeric_price = None
    raw_price_text = None
    if isinstance(price_text, (int, float)):
        numeric_price = float(price_text)
        raw_price_text = str(price_text)
    elif isinstance(price_text, str):
        numeric_price = parse_price(price_text)
        raw_price_text = price_text

    name = item.get("name") if isinstance(item.get("name"), str) else None
    url = item.get("url") if isinstance(item.get("url"), str) else None

    if numeric_price is None and raw_price_text is None:
        return None

    return JsonLdProduct(
        name=name,
        price=numeric_price,
        currency=currency,
        url=url,
        raw_price_text=raw_price_text,
    )


def find_price_candidates(soup: BeautifulSoup, selectors: Iterable[str]) -> List[Tuple[str, str, str]]:
    """Return potential (name, price_text, url) tuples from HTML selectors."""

    candidates: List[Tuple[str, str, str]] = []
    for selector in selectors:
        for element in soup.select(selector):
            price_text = element.get_text(" ", strip=True)
            if not price_text:
                continue
            price_value = parse_price(price_text)
            if price_value is None:
                continue

            product_link = element.find_parent("a") or element.find_previous("a")
            product_name = None
            product_url = None
            if product_link:
                product_name = product_link.get_text(" ", strip=True)
                product_url = product_link.get("href")

            if not product_name:
                title_el = element.find_previous(class_=re.compile("name|title", re.I))
                if title_el:
                    product_name = title_el.get_text(" ", strip=True)

            candidates.append(
                (
                    product_name or "Ürün",  # default name placeholder
                    price_text,
                    product_url or "",
                )
            )
    return candidates
