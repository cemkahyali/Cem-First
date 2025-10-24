"""Tests for price comparison aggregator ordering."""

from __future__ import annotations

from typing import Callable, Dict
import pathlib
import sys

import pytest

# Ensure the project root is on sys.path for direct package imports.
PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from price_fetchers import aggregator
from price_fetchers.base import PriceResult


@pytest.fixture()
def fake_fetchers(monkeypatch: pytest.MonkeyPatch) -> Dict[str, Callable[[str], PriceResult]]:
    """Provide deterministic fake fetchers for the aggregator."""

    def make_success(retailer: str, price: float) -> Callable[[str], PriceResult]:
        def _fetch(_query: str) -> PriceResult:
            return PriceResult(retailer=retailer, price=price)

        return _fetch

    def failing_fetch(_query: str) -> PriceResult:
        return PriceResult(retailer="Failure", error="timeout")

    def missing_price_fetch(_query: str) -> PriceResult:
        return PriceResult(retailer="MissingPrice")

    fakes = {
        "Cheap": make_success("Cheap", 10.0),
        "Expensive": make_success("Expensive", 25.0),
        "Failure": failing_fetch,
        "MissingPrice": missing_price_fetch,
    }
    monkeypatch.setattr(aggregator, "FETCHERS", fakes)
    return fakes


def test_compare_prices_returns_successes_sorted_before_failures(fake_fetchers):
    """Successful results are sorted by price and precede failed entries."""

    results = aggregator.compare_prices("query")

    successful = [result for result in results if result.is_successful]
    failed = [result for result in results if not result.is_successful]

    assert [result.retailer for result in successful] == ["Cheap", "Expensive"]
    assert all(result.is_successful for result in successful)
    assert {result.retailer for result in failed} == {"Failure", "MissingPrice"}

    # The combined output keeps successful entries before any failures.
    assert [result.retailer for result in results[: len(successful)]] == [
        "Cheap",
        "Expensive",
    ]
    assert all(not result.is_successful for result in results[len(successful) :])
