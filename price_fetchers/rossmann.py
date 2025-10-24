"""Price extraction logic for Rossmann Türkiye."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .base import PriceResult
from .utils import FetchError, fetch_html, find_price_candidates, parse_json_ld_products, parse_price

logger = logging.getLogger(__name__)

BASE_URL = "https://www.rossmann.com.tr"
SEARCH_PATH = "/catalogsearch/result"
_REQUEST_HEADERS = {
    "User-Agent": "python-requests/2.31.0",
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}
PRICE_SELECTORS = [
    "[class*='price']",
    "[data-test='price']",
    ".product-box__prices",
    ".product-card [class*='Price']",
    ".price",
    "[data-price]",
    ".product-price",
    ".price-value",
    ".amount",
    "[class*='amount']",
    "[class*='cost']",
    ".cost",
    ".value",
    "[class*='value']",
    ".price-box",
    "[class*='price-box']",
    ".price-container",
    "[class*='price-container']",
    ".product-item-price",
    "[class*='product-item-price']",
]


def search_product(query: str) -> PriceResult:
    """Return pricing information for the first product match on Rossmann."""

    retailer = "Rossmann"
    try:
        search_urls = [
            f"{BASE_URL}/catalogsearch/result/",
            urljoin(BASE_URL, SEARCH_PATH),
            f"{BASE_URL}/search/",
        ]

        html: Optional[str] = None
        final_url: Optional[str] = None
        for url in search_urls:
            try:
                html, final_url = fetch_html(
                    url,
                    params={"q": query},
                    headers=_REQUEST_HEADERS,
                    include_default_headers=False,
                )
            except FetchError:
                continue
            if html:
                break

        if not html:
            return PriceResult(retailer=retailer, error="Rossmann sitesine erişilemiyor")

    except FetchError as exc:
        return PriceResult(retailer=retailer, error=f"Rossmann isteği başarısız: {exc}")

    debug = {"source_url": final_url, "strategy": "json-ld"}
    for product in parse_json_ld_products(html):
        price = product.price or parse_price(product.raw_price_text or "")
        if price is None:
            continue
        product_url = product.url
        if product_url:
            product_url = urljoin(BASE_URL, product_url)
        return PriceResult(
            retailer=retailer,
            product_name=product.name,
            price=price,
            currency=product.currency or "TRY",
            product_url=product_url,
            raw_price_text=product.raw_price_text,
            debug=debug,
        )

    # Attempt to parse embedded product data served with the page markup
    embedded_products = _extract_initial_products(html)
    if embedded_products:
        debug = {"source_url": final_url, "strategy": "embedded-json"}
        for product in embedded_products:
            source = product.get("_source") if isinstance(product, dict) else None
            if not source:
                continue

            special_price_raw = _safe_float(source.get("special_price"))
            base_price_raw = _safe_float(source.get("price"))
            loyalty_price_raw = _first_non_empty(
                _safe_float(source.get("ross_60_price")),
                _safe_float(source.get("ross_60_price_web")),
            )
            alt_prices = [
                _safe_float(source.get("crm_price")),
                _safe_float(source.get("cmp_100_price")),
                _safe_float(source.get("cmp_50_price")),
                _safe_float(source.get("cmp_20_price")),
            ]

            price = None
            original_price = None

            if loyalty_price_raw and special_price_raw and loyalty_price_raw < special_price_raw - 0.01:
                price = loyalty_price_raw
                original_price = special_price_raw or base_price_raw
            elif special_price_raw and base_price_raw and special_price_raw < base_price_raw - 0.01:
                price = special_price_raw
                original_price = base_price_raw
            else:
                price = _first_non_empty(
                    special_price_raw,
                    base_price_raw,
                    loyalty_price_raw,
                    *alt_prices,
                )

                if price is None:
                    continue

                comparison_candidates = [
                    base_price_raw,
                    special_price_raw if special_price_raw not in (None, price) else None,
                ]
                for candidate in comparison_candidates:
                    if candidate is not None and candidate > price + 0.01:
                        original_price = candidate
                        break

            if price is None or price <= 0:
                continue

            if original_price is not None and (
                original_price <= 0 or original_price <= price + 0.01
            ):
                original_price = None

            product_name = _first_non_empty(
                source.get("name"),
                source.get("name1"),
                source.get("name2"),
            )
            if not product_name:
                continue

            url_key = _first_non_empty(source.get("url_key"), source.get("url_path"))
            product_url = urljoin(f"{BASE_URL}/", url_key) if url_key else None

            raw_price_text = _format_price(price)
            original_price_text = _format_price(original_price) if original_price is not None else None

            return PriceResult(
                retailer=retailer,
                product_name=product_name,
                price=price,
                currency="TRY",
                product_url=product_url,
                raw_price_text=raw_price_text,
                original_price=original_price,
                original_price_text=original_price_text,
                debug={**debug, "product_id": source.get("id")},
            )

    debug["strategy"] = "html-selectors"
    soup = BeautifulSoup(html, "html.parser")
    for name, price_text, url in find_price_candidates(soup, PRICE_SELECTORS):
        price = parse_price(price_text)
        if price is None:
            continue
        product_url = urljoin(BASE_URL, url)
        return PriceResult(
            retailer=retailer,
            product_name=name,
            price=price,
            currency="TRY",
            product_url=product_url,
            raw_price_text=price_text,
            debug=debug,
        )

    return PriceResult(
        retailer=retailer,
        error="Rossmann sitesinde sonuç bulunamadı",
        debug=debug,
    )


def _extract_initial_products(html: str) -> List[Dict[str, Any]]:
    """Extract the initial product list embedded in the Rossmann markup."""

    marker = "initialProducts:"
    marker_index = html.find(marker)
    if marker_index == -1:
        return []

    array_start = html.find("[", marker_index)
    if array_start == -1:
        return []

    payload = _slice_json_array(html, array_start)
    if not payload:
        return []

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        logger.debug("Rossmann embedded products JSON decoding failed", exc_info=True)
        return []

    return data if isinstance(data, list) else []


def _slice_json_array(text: str, start_index: int) -> str:
    """Return the JSON array substring beginning at start_index or '' if parsing fails."""

    if start_index < 0 or start_index >= len(text) or text[start_index] != "[":
        return ""

    depth = 0
    in_string = False
    escape = False
    for pos in range(start_index, len(text)):
        char = text[pos]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return text[start_index : pos + 1]

    logger.debug("Rossmann embedded products JSON array parsing failed to find closing bracket")
    return ""


def _first_non_empty(*values: Any) -> Optional[Any]:
    """Return the first truthy value from the provided arguments."""

    for value in values:
        if value not in (None, "", []):
            return value
    return None


def _safe_float(value: Any) -> Optional[float]:
    """Best-effort conversion to float."""

    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", "."))
        except ValueError:
            return None
    return None


def _format_price(value: Optional[float]) -> Optional[str]:
    """Return a Turkish Lira formatted price string."""

    if value is None:
        return None
    return f"{value:,.2f} TL".replace(",", "X").replace(".", ",").replace("X", ".")
