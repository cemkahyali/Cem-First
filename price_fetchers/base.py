"""Base definitions shared by price fetchers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PriceResult:
    """Structured price information returned from a retailer."""

    retailer: str
    product_name: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    product_url: Optional[str] = None
    raw_price_text: Optional[str] = None
    original_price: Optional[float] = None
    original_price_text: Optional[str] = None
    error: Optional[str] = None
    debug: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Return a JSON-serialisable dictionary of the price result."""

        return {
            "retailer": self.retailer,
            "product_name": self.product_name,
            "price": self.price,
            "currency": self.currency,
            "product_url": self.product_url,
            "raw_price_text": self.raw_price_text,
            "original_price": self.original_price,
            "original_price_text": self.original_price_text,
            "error": self.error,
            "debug": self.debug,
        }

    @property
    def is_successful(self) -> bool:
        """True when a price was retrieved without errors."""

        return self.error is None and self.price is not None
