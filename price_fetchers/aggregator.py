"""Coordinate price fetching across all supported retailers."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

from .base import PriceResult
from . import gratis, rossmann

FETCHERS = {
    "Rossmann": rossmann.search_product,
    "Gratis": gratis.search_product,
}


def compare_prices(query: str) -> List[PriceResult]:
    """Fetch price information from all retailers sorted by price."""

    results: List[PriceResult] = []
    with ThreadPoolExecutor(max_workers=len(FETCHERS)) as executor:
        future_map = {executor.submit(fetcher, query): name for name, fetcher in FETCHERS.items()}
        for future in as_completed(future_map):
            name = future_map[future]
            try:
                result = future.result()
            except Exception as exc:  # pragma: no cover - runtime guard
                result = PriceResult(retailer=name, error=str(exc))
            results.append(result)

    successful = sorted(
        (result for result in results if result.is_successful),
        key=lambda result: result.price or float("inf"),
    )
    failed = [result for result in results if not result.is_successful]
    return [*successful, *failed]
