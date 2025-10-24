"""Price extraction logic for Gratis Türkiye."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .base import PriceResult
from .utils import FetchError, fetch_html, find_price_candidates, parse_json_ld_products, parse_price

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gratis.com"
SEARCH_PATH = "/search"
PRICE_SELECTORS = [
    "span.text-primary-900",  # Based on debug output
    "[class*='text-primary-900']",
    "[class*='font-semibold']",
    "[class*='price']",
    "[data-test='price']",
    ".product-list__price",
    ".product-card [class*='Price']",
    "[class*='Price']",
    "[class*='price']",
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
]


def search_product(query: str) -> PriceResult:
    """Return pricing information for the first product match on Gratis."""

    retailer = "Gratis"
    try:
        html, final_url = fetch_html(
            urljoin(BASE_URL, SEARCH_PATH),
            params={"q": query},
            allow_insecure_ssl=True,
        )
    except FetchError as exc:
        return PriceResult(retailer=retailer, error=f"Gratis isteği başarısız: {exc}")

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

    embedded_products = _extract_products_from_embedded_state(html)
    if embedded_products:
        debug = {"source_url": final_url, "strategy": "embedded-json"}
        for product in embedded_products:
            price_info = product.get("prices", {})
            raw_price_text = (
                price_info.get("discountedPriceLabel")
                or price_info.get("promotionPriceLabel")
                or price_info.get("normalPriceLabel")
            )

            discounted_price = _normalise_price(price_info.get("discountedPrice"))
            promotional_price = _normalise_price(price_info.get("promotionPrice"))
            normal_price = _normalise_price(price_info.get("normalPrice"))

            price = _first_non_none(discounted_price, promotional_price, normal_price)
            if price is None and raw_price_text:
                price = parse_price(raw_price_text)
            if price is None:
                continue

            attributes = product.get("attributes", {})
            product_name = attributes.get("displayName") or product.get("analytics", {}).get("name")
            if not product_name:
                continue

            product_url = product.get("shareLink") or product.get("url")
            if product_url:
                product_url = urljoin(BASE_URL, product_url)

            currency = price_info.get("currency") or "TRY"

            original_price = normal_price
            original_price_text = price_info.get("normalPriceLabel") or _format_price(original_price)

            if original_price is not None and price is not None and abs(original_price - price) < 0.01:
                original_price = None
                original_price_text = None

            if raw_price_text is None:
                raw_price_text = (
                    price_info.get("discountedPriceLabel")
                    or price_info.get("promotionPriceLabel")
                    or _format_price(price)
                )

            return PriceResult(
                retailer=retailer,
                product_name=product_name,
                price=price,
                currency=currency,
                product_url=product_url,
                raw_price_text=raw_price_text,
                original_price=original_price,
                original_price_text=original_price_text,
                debug={**debug, "product_id": product.get("id")},
            )

    debug["strategy"] = "html-selectors"
    soup = BeautifulSoup(html, "html.parser")
    for name, price_text, url in find_price_candidates(soup, PRICE_SELECTORS):
        price = parse_price(price_text)
        if price is None:
            continue
        
        # Try to find a better product name if current one is generic
        if name in ["Anasayfa", "Ürün", "Product"] or len(name) < 3:
            # Look for product names in nearby elements
            price_element = soup.find(string=lambda text: text and price_text in text)
            if price_element:
                parent = price_element.parent
                # Look for product name in parent or nearby elements
                for selector in [".product-name", ".product-title", "[class*='name']", "[class*='title']"]:
                    name_element = parent.select_one(selector) if parent else None
                    if name_element and name_element.get_text(strip=True):
                        name = name_element.get_text(strip=True)
                        break
        
        product_url = urljoin(BASE_URL, url) if url else None
        return PriceResult(
            retailer=retailer,
            product_name=name if name and name not in ["Anasayfa", "Ürün", "Product"] else f"Gratis Ürünü",
            price=price,
            currency="TRY",
            product_url=product_url,
            raw_price_text=price_text,
            debug=debug,
        )

    return PriceResult(
        retailer=retailer,
        error="Gratis sitesinde sonuç bulunamadı",
        debug=debug,
    )


def _extract_products_from_embedded_state(html: str) -> List[Dict[str, Any]]:
    """Parse the embedded Next.js flight payload for product information."""

    marker = 'products\\":['
    start_idx = html.find(marker)
    if start_idx == -1:
        return []

    start = start_idx + len('products\\":')
    end = start
    depth = 0
    length = len(html)
    while end < length:
        char = html[end]
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                end += 1
                break
        elif char == "\\":
            end += 1  # skip escaped character
        end += 1

    if depth != 0:
        logger.debug("Failed to locate complete embedded products array in Gratis response")
        return []

    escaped_payload = html[start:end]
    try:
        decoded = bytes(escaped_payload, "utf-8").decode("unicode_escape")
        try:
            decoded = decoded.encode("latin-1").decode("utf-8")
        except UnicodeEncodeError:
            pass
        data = json.loads(decoded)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        logger.debug("Gratis embedded payload JSON decoding failed", exc_info=True)
    except UnicodeDecodeError:
        logger.debug("Gratis embedded payload unicode decoding failed", exc_info=True)

    return []


def _normalise_price(value: Any) -> Optional[float]:
    """Convert Gratis price values to float TRY."""

    if value is None:
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric >= 1000:
            return numeric / 100.0
        return numeric
    if isinstance(value, str):
        return parse_price(value)
    return None


def _format_price(value: Optional[float]) -> Optional[str]:
    if value is None:
        return None
    return f"{value:,.2f} TL".replace(",", "X").replace(".", ",").replace("X", ".")


def _first_non_none(*values: Any) -> Optional[Any]:
    for value in values:
        if value is not None:
            return value
    return None
