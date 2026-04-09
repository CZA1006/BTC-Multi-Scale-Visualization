from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import requests

from .data_paths import POLYMARKET_SELECTED_DAY_DIR

GAMMA_SEARCH_URL = "https://gamma-api.polymarket.com/public-search"

THEME_QUERIES = [
    {"theme": "bitcoin_etf", "query": "bitcoin etf"},
    {"theme": "crypto_regulation", "query": "crypto regulation"},
    {"theme": "us_election", "query": "us election crypto"},
    {"theme": "fed_rates", "query": "fed rates crypto"},
]


def _cache_path_for_today():
    POLYMARKET_SELECTED_DAY_DIR.mkdir(parents=True, exist_ok=True)
    return POLYMARKET_SELECTED_DAY_DIR / f"{datetime.now(UTC).date().isoformat()}.json"


def _safe_json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _safe_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_market_snapshot(event: dict[str, Any], theme: str, query: str) -> dict[str, Any] | None:
    markets = event.get("markets") or []
    active_markets = [
        market for market in markets if market.get("active") and not market.get("closed")
    ]
    if not active_markets:
        active_markets = markets
    if not active_markets:
        return None

    market = active_markets[0]
    outcomes = _safe_json_list(market.get("outcomes"))
    outcome_prices = _safe_json_list(market.get("outcomePrices"))

    yes_price = _safe_float(outcome_prices[0]) if len(outcome_prices) > 0 else None
    no_price = _safe_float(outcome_prices[1]) if len(outcome_prices) > 1 else None

    return {
        "as_of_date": datetime.now(UTC).date().isoformat(),
        "theme": theme,
        "source_query": query,
        "event_slug": event.get("slug"),
        "event_title": event.get("title"),
        "market_slug": market.get("slug"),
        "market_name": market.get("question") or event.get("title"),
        "yes_label": outcomes[0] if len(outcomes) > 0 else "Yes",
        "no_label": outcomes[1] if len(outcomes) > 1 else "No",
        "yes_price": yes_price,
        "no_price": no_price,
        "volume": _safe_float(market.get("volume24hr")) or _safe_float(market.get("volume")),
        "liquidity": _safe_float(market.get("liquidity")) or _safe_float(market.get("liquidityClob")),
        "end_date": market.get("endDate") or event.get("endDate"),
        "status": "active" if market.get("active") else "inactive",
        "source": "gamma_public_search",
    }


def _fetch_current_snapshot() -> dict[str, Any]:
    markets: list[dict[str, Any]] = []

    for item in THEME_QUERIES:
        response = requests.get(
            GAMMA_SEARCH_URL,
            params={
                "q": item["query"],
                "events_status": "active",
                "limit_per_type": 3,
                "search_profiles": "false",
                "search_tags": "false",
                "optimized": "true",
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        events = payload.get("events") or []
        if not events:
            continue

        snapshot = _extract_market_snapshot(events[0], item["theme"], item["query"])
        if snapshot is not None:
            markets.append(snapshot)

    return {
        "as_of_date": datetime.now(UTC).date().isoformat(),
        "status": "live",
        "message": "Loaded current Polymarket context from public search.",
        "markets": markets,
    }


def get_current_polymarket_context() -> dict[str, Any]:
    cache_path = _cache_path_for_today()
    if cache_path.exists():
        with cache_path.open("r", encoding="utf-8") as handle:
            cached_payload = json.load(handle)
        cached_payload["status"] = "cached"
        cached_payload["message"] = "Loaded current Polymarket context from local cache."
        return cached_payload

    try:
        payload = _fetch_current_snapshot()
    except Exception as exc:
        return {
            "as_of_date": datetime.now(UTC).date().isoformat(),
            "status": "fetch_error",
            "message": f"Failed to load Polymarket context: {exc}",
            "markets": [],
        }

    with cache_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    return payload
