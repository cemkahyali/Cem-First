"""Price fetcher package exposing comparison utilities."""

from .aggregator import compare_prices
from .base import PriceResult

__all__ = ["compare_prices", "PriceResult"]
