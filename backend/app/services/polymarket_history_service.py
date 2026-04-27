"""Date-aware historical Polymarket service (P8).

Replaces the recency-biased `polymarket_service.get_current_polymarket_context`
for the day-detail route. For a given `selectedDate`, this service:

1. Looks up the curated case-study bucket containing the date
   (`polymarket_curated.py`).
2. For each event slug in the bucket, hits Gamma `/events?slug=...` to get
   the market list and `clobTokenIds`.
3. For the YES token of each market, hits CLOB `/prices-history?interval=max`
   to get the daily price time series.
4. Returns a payload keyed on the selectedDate with:
   - `markets`: list of `{question, slug, theme, end_date, volume,
     yes_label, no_label, yes_price_at_date, history: [{t, p}]}`.
   - `status`: `historical | unavailable | fetch_error`.

All network responses are cached on disk so a presentation laptop with no
internet still serves a coherent payload (the fetch script in
`backend/scripts/fetch_polymarket_history.py` warms the cache).
"""

from __future__ import annotations

import json
from datetime import date as _date
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

from .data_paths import POLYMARKET_EVENTS_DIR, POLYMARKET_HISTORY_DIR
from .polymarket_curated import (
    CuratedBucket,
    find_bucket_for_date,
    infer_theme,
)

GAMMA_EVENTS_URL = "https://gamma-api.polymarket.com/events"
CLOB_PRICES_HISTORY_URL = "https://clob.polymarket.com/prices-history"

REQUEST_TIMEOUT = 25
DEFAULT_FIDELITY_MIN = 1440  # 1 day
MIN_VOLUME = 1000.0  # USDC; drop markets below this threshold (illiquid)
MAX_MARKETS_PER_DATE = 8  # cap returned markets to keep the UI legible


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------


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


def _parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Event metadata cache
# ---------------------------------------------------------------------------


def _event_cache_path(slug: str) -> Path:
    _ensure_dir(POLYMARKET_EVENTS_DIR)
    return POLYMARKET_EVENTS_DIR / f"{slug}.json"


def _fetch_event_remote(slug: str) -> dict[str, Any] | None:
    """Hit Gamma /events for a single slug. Returns the first event or None."""
    response = requests.get(
        GAMMA_EVENTS_URL,
        params={"slug": slug, "limit": 1},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, list) and payload:
        return payload[0]
    if isinstance(payload, dict) and payload.get("data"):
        return payload["data"][0]
    return None


def load_event(slug: str, *, refresh: bool = False) -> dict[str, Any] | None:
    """Return the cached event payload for `slug`, refreshing on demand."""
    cache_path = _event_cache_path(slug)
    if cache_path.exists() and not refresh:
        try:
            with cache_path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except (OSError, json.JSONDecodeError):
            pass

    try:
        event = _fetch_event_remote(slug)
    except requests.RequestException:
        return None

    if event is None:
        return None

    try:
        with cache_path.open("w", encoding="utf-8") as handle:
            json.dump(event, handle, ensure_ascii=False, indent=2)
    except OSError:
        pass
    return event


# ---------------------------------------------------------------------------
# Token price-history cache
# ---------------------------------------------------------------------------


def _history_cache_path(token_id: str) -> Path:
    _ensure_dir(POLYMARKET_HISTORY_DIR)
    # Token IDs are huge integers; store under a safe filename.
    safe = str(token_id).replace("/", "_")
    return POLYMARKET_HISTORY_DIR / f"{safe}.json"


def _fetch_token_history_remote(token_id: str) -> list[dict[str, Any]]:
    response = requests.get(
        CLOB_PRICES_HISTORY_URL,
        params={
            "market": token_id,
            "interval": "max",
            "fidelity": DEFAULT_FIDELITY_MIN,
        },
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    history = payload.get("history") if isinstance(payload, dict) else None
    if not isinstance(history, list):
        return []
    return [
        {"t": int(point["t"]), "p": float(point["p"])}
        for point in history
        if isinstance(point, dict) and "t" in point and "p" in point
    ]


def load_token_history(
    token_id: str, *, refresh: bool = False
) -> list[dict[str, Any]]:
    """Return the cached price history for `token_id`, refreshing on demand."""
    cache_path = _history_cache_path(token_id)
    if cache_path.exists() and not refresh:
        try:
            with cache_path.open("r", encoding="utf-8") as handle:
                cached = json.load(handle)
            if isinstance(cached, list):
                return cached
        except (OSError, json.JSONDecodeError):
            pass

    try:
        history = _fetch_token_history_remote(token_id)
    except requests.RequestException:
        return []

    try:
        with cache_path.open("w", encoding="utf-8") as handle:
            json.dump(history, handle, ensure_ascii=False)
    except OSError:
        pass
    return history


# ---------------------------------------------------------------------------
# Per-market shaping
# ---------------------------------------------------------------------------


def _market_lifespan_contains(
    market: dict[str, Any], target: _date, *, post_resolution_days: int = 14
) -> bool:
    """Whether a market is informative on `target`.

    A market is "live enough" if it had started by `target` and resolved
    no more than `post_resolution_days` days before `target` (so the
    final settled price is still meaningful demo context).
    """
    start = _parse_iso(market.get("startDate"))
    end = _parse_iso(market.get("endDate"))
    target_dt = datetime.combine(target, datetime.min.time(), tzinfo=timezone.utc)
    if start and target_dt < start:
        return False
    if end is not None:
        cutoff = target_dt - timedelta(days=post_resolution_days)
        if end < cutoff:
            return False
    return True


def _price_at_or_before(
    history: list[dict[str, Any]], target_ts: int
) -> tuple[float | None, int | None]:
    """Last point with t <= target_ts; falls back to the closest point overall."""
    if not history:
        return None, None
    earlier = [pt for pt in history if pt["t"] <= target_ts]
    if earlier:
        last = earlier[-1]
        return float(last["p"]), int(last["t"])
    closest = min(history, key=lambda pt: abs(pt["t"] - target_ts))
    return float(closest["p"]), int(closest["t"])


def _shape_market(
    market: dict[str, Any],
    *,
    event_title: str,
    target: _date,
    refresh: bool,
) -> dict[str, Any] | None:
    token_ids = _safe_json_list(market.get("clobTokenIds"))
    if not token_ids:
        return None
    yes_token = str(token_ids[0])

    outcomes = _safe_json_list(market.get("outcomes"))
    yes_label = outcomes[0] if len(outcomes) > 0 else "Yes"
    no_label = outcomes[1] if len(outcomes) > 1 else "No"

    history = load_token_history(yes_token, refresh=refresh)
    target_ts = int(
        datetime.combine(target, datetime.min.time(), tzinfo=timezone.utc).timestamp()
    )
    price_at_date, observed_ts = _price_at_or_before(history, target_ts)

    question = market.get("question") or event_title

    return {
        "market_slug": market.get("slug"),
        "market_name": question,
        "event_title": event_title,
        "theme": infer_theme(question),
        "yes_label": yes_label,
        "no_label": no_label,
        "yes_token_id": yes_token,
        "yes_price_at_date": price_at_date,
        "yes_price_observed_at": (
            datetime.fromtimestamp(observed_ts, tz=timezone.utc).isoformat()
            if observed_ts is not None
            else None
        ),
        "current_yes_price": _safe_float(
            (_safe_json_list(market.get("outcomePrices")) or [None])[0]
        ),
        "volume": _safe_float(market.get("volume")),
        "liquidity": _safe_float(market.get("liquidity"))
        or _safe_float(market.get("liquidityClob")),
        "start_date": market.get("startDate"),
        "end_date": market.get("endDate"),
        "closed": bool(market.get("closed")),
        "history": history,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_polymarket_for_date(
    target: _date | str, *, refresh: bool = False
) -> dict[str, Any]:
    """Return the date-aware Polymarket payload for the day-detail route."""
    if isinstance(target, str):
        target = _date.fromisoformat(target)

    bucket = find_bucket_for_date(target)
    if bucket is None or not bucket.event_slugs:
        return {
            "as_of_date": target.isoformat(),
            "status": "unavailable",
            "message": (
                bucket.note
                if bucket and bucket.note
                else "No curated Polymarket coverage for this date."
            ),
            "bucket": bucket.key if bucket else None,
            "bucket_label": bucket.label if bucket else None,
            "markets": [],
        }

    markets: list[dict[str, Any]] = []
    for slug in bucket.event_slugs:
        event = load_event(slug, refresh=refresh)
        if not event:
            continue
        event_title = event.get("title") or slug
        for raw_market in event.get("markets") or []:
            if not _market_lifespan_contains(raw_market, target):
                continue
            shaped = _shape_market(
                raw_market,
                event_title=event_title,
                target=target,
                refresh=refresh,
            )
            if shaped is not None:
                markets.append(shaped)

    if not markets:
        return {
            "as_of_date": target.isoformat(),
            "status": "unavailable",
            "message": (
                f"No Polymarket markets in the {bucket.label} window were "
                "live on this date."
            ),
            "bucket": bucket.key,
            "bucket_label": bucket.label,
            "markets": [],
        }

    # Drop illiquid markets, then sort by volume desc and cap.
    markets = [m for m in markets if (m.get("volume") or 0.0) >= MIN_VOLUME]
    markets.sort(key=lambda m: -(m.get("volume") or 0.0))
    markets = markets[:MAX_MARKETS_PER_DATE]

    return {
        "as_of_date": target.isoformat(),
        "status": "historical",
        "message": (
            f"Showing {len(markets)} curated Polymarket markets active on "
            f"{target.isoformat()} ({bucket.label})."
        ),
        "bucket": bucket.key,
        "bucket_label": bucket.label,
        "markets": markets,
    }
