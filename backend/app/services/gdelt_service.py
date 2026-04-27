from __future__ import annotations

import json
import time
from datetime import datetime, timedelta
from typing import Any

import requests

from .data_paths import GDELT_SELECTED_DAY_DIR

GDELT_DOC_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_DOC_LOOKBACK_DAYS = 90
DISPLAY_EVENT_RECORDS = 15
GDELT_ARTLIST_MAX_RECORDS = 250
CACHE_SCHEMA_VERSION = 7
DEFAULT_QUERY = (
    "(bitcoin OR btc OR crypto OR cryptocurrency OR blockchain "
    'OR "spot bitcoin etf" OR sec OR coinbase OR microstrategy)'
)

CATEGORY_KEYWORDS = {
    "regulation": ["sec", "regulation", "regulatory", "etf", "lawsuit", "policy"],
    "election": ["election", "trump", "biden", "white house", "campaign"],
    "war": ["war", "ukraine", "russia", "iran", "israel", "missile", "conflict"],
    "macro": ["fed", "federal reserve", "inflation", "rates", "cpi", "powell"],
    "crypto": ["bitcoin", "btc", "crypto", "cryptocurrency", "blockchain"],
}

def _cache_path_for_date(date_str: str):
    GDELT_SELECTED_DAY_DIR.mkdir(parents=True, exist_ok=True)
    return GDELT_SELECTED_DAY_DIR / f"{date_str}.json"


def _infer_category(headline: str, url: str) -> str:
    haystack = f"{headline} {url}".lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return category
    return "general"


def _parse_gdelt_timestamp(raw_timestamp: str | None) -> str | None:
    if not raw_timestamp:
        return None

    cleaned = raw_timestamp.strip()
    for fmt in ("%Y%m%d%H%M%S", "%Y%m%dT%H%M%SZ"):
        try:
            return datetime.strptime(cleaned, fmt).isoformat()
        except ValueError:
            continue
    return None


def _extract_raw_tone(article: dict[str, Any]) -> float | None:
    # DOC ArtList may expose `tone`; GKG-style payloads expose `v2tone`
    # where the first value is RawTone. Parse whichever is available.
    direct_tone = article.get("tone") or article.get("Tone")
    if direct_tone is not None and str(direct_tone).strip() != "":
        try:
            return float(direct_tone)
        except (TypeError, ValueError):
            pass

    for key in ("v2tone", "V2Tone", "v2Tone", "V2TONE"):
        v2tone = article.get(key)
        if v2tone is None or str(v2tone).strip() == "":
            continue
        # GDELT V2Tone is a comma-separated tuple. Index 0 is RawTone.
        first_value = str(v2tone).split(",")[0].strip()
        try:
            return float(first_value)
        except (TypeError, ValueError):
            continue
    return None


def _request_gdelt_doc(params: dict[str, str], timeout: int = 10, retries: int = 2) -> dict[str, Any]:
    """Call GDELT DOC API with bounded retries for transient failures."""
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(GDELT_DOC_API_URL, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except Exception as exc:  # noqa: BLE001 - keep broad for robust fetch retries
            last_error = exc
            if attempt < retries:
                time.sleep(attempt * 1.5)
    raise RuntimeError(f"GDELT DOC request failed after {retries} attempts: {last_error}")


def _parse_any_timestamp(raw: Any) -> datetime | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None

    for fmt in ("%Y%m%d%H%M%S", "%Y%m%dT%H%M%SZ", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number


def _coerce_int(value: Any) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _extract_timeseries_rows(
    payload: dict[str, Any],
    timestamp_keys: set[str],
    value_keys: set[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if (timestamp_keys & set(node.keys())) and (value_keys & set(node.keys())):
                rows.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return rows


def _build_hourly_tones_from_timeline(
    date_str: str, timeline_payload: dict[str, Any]
) -> list[dict[str, Any]]:
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    buckets = {
        hour: {"news_count": 0, "tone_acc": 0.0, "tone_weight": 0}
        for hour in range(24)
    }

    for row in _extract_timeseries_rows(
        timeline_payload,
        timestamp_keys={"datetime", "date", "timestamp", "time", "d"},
        value_keys={"value", "tone", "avg_tone", "average_tone"},
    ):
        timestamp_raw = (
            row.get("datetime")
            or row.get("date")
            or row.get("timestamp")
            or row.get("time")
            or row.get("d")
        )
        parsed = _parse_any_timestamp(timestamp_raw)
        if parsed is None or parsed.date() != target_date:
            continue

        tone_value = _coerce_float(
            row.get("value")
            or row.get("tone")
            or row.get("avg_tone")
            or row.get("average_tone")
        )
        news_count = _coerce_int(
            row.get("news_count")
            or row.get("count")
            or row.get("volume")
            or row.get("articles")
            or row.get("numarticles")
            or row.get("norm")
        )
        if news_count <= 0:
            news_count = 1 if tone_value is not None else 0

        bucket = buckets[parsed.hour]
        bucket["news_count"] += news_count
        if tone_value is not None and news_count > 0:
            bucket["tone_acc"] += tone_value * news_count
            bucket["tone_weight"] += news_count

    hourly_rows: list[dict[str, Any]] = []
    for hour in range(24):
        aggregate = buckets[hour]
        average_tone = (
            aggregate["tone_acc"] / aggregate["tone_weight"]
            if aggregate["tone_weight"] > 0
            else None
        )
        hourly_rows.append(
            {
                "timestamp": f"{date_str}T{hour:02d}:00:00.000Z",
                "news_count": int(aggregate["news_count"]),
                "average_tone": average_tone,
            }
        )
    return hourly_rows


def _build_hourly_counts_from_timeline_volraw(
    date_str: str, volume_payload: dict[str, Any]
) -> list[dict[str, Any]]:
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    buckets = {hour: 0 for hour in range(24)}

    for row in _extract_timeseries_rows(
        volume_payload,
        timestamp_keys={"datetime", "date", "timestamp", "time", "d"},
        value_keys={"value", "count", "news_count", "articles", "numarticles"},
    ):
        timestamp_raw = (
            row.get("datetime")
            or row.get("date")
            or row.get("timestamp")
            or row.get("time")
            or row.get("d")
        )
        parsed = _parse_any_timestamp(timestamp_raw)
        if parsed is None or parsed.date() != target_date:
            continue

        count_value = _coerce_int(
            row.get("value")
            or row.get("count")
            or row.get("news_count")
            or row.get("articles")
            or row.get("numarticles")
        )
        if count_value > 0:
            buckets[parsed.hour] += count_value

    return [
        {
            "timestamp": f"{date_str}T{hour:02d}:00:00.000Z",
            "news_count": int(buckets[hour]),
        }
        for hour in range(24)
    ]


def _build_hourly_tones_from_articles(
    date_str: str, raw_articles: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    buckets = {
        hour: {"news_count": 0, "tone_acc": 0.0, "tone_weight": 0}
        for hour in range(24)
    }
    for article in raw_articles or []:
        parsed = _parse_any_timestamp(article.get("seendate"))
        if parsed is None or parsed.date() != datetime.strptime(date_str, "%Y-%m-%d").date():
            continue
        tone = _extract_raw_tone(article)
        bucket = buckets[parsed.hour]
        bucket["news_count"] += 1
        if tone is not None:
            bucket["tone_acc"] += tone
            bucket["tone_weight"] += 1

    rows: list[dict[str, Any]] = []
    for hour in range(24):
        aggregate = buckets[hour]
        average_tone = (
            aggregate["tone_acc"] / aggregate["tone_weight"]
            if aggregate["tone_weight"] > 0
            else None
        )
        rows.append(
            {
                "timestamp": f"{date_str}T{hour:02d}:00:00.000Z",
                "news_count": int(aggregate["news_count"]),
                "average_tone": average_tone,
            }
        )
    return rows


def _build_empty_payload(date_str: str, status: str, message: str) -> dict[str, Any]:
    return {
        "cache_schema_version": CACHE_SCHEMA_VERSION,
        "date": date_str,
        "status": status,
        "message": message,
        "news_count": 0,
        "theme_count_crypto": 0,
        "theme_count_regulation": 0,
        "theme_count_election": 0,
        "theme_count_war": 0,
        "top_headlines": [],
        "articles": [],
    }


def _normalize_gdelt_payload(
    date_str: str,
    raw_articles: list[dict[str, Any]],
    timeline_payload: dict[str, Any] | None,
    volume_payload: dict[str, Any] | None,
    timeline_status: str = "ok",
    volume_status: str = "ok",
) -> dict[str, Any]:
    raw_articles = raw_articles or []
    articles: list[dict[str, Any]] = []
    theme_counts = {
        "crypto": 0,
        "regulation": 0,
        "election": 0,
        "war": 0,
    }

    for article in raw_articles:
        headline = (article.get("title") or "").strip()
        url = (article.get("url") or "").strip()
        category = _infer_category(headline, url)
        raw_tone = _extract_raw_tone(article)
        if category in theme_counts:
            theme_counts[category] += 1

        articles.append(
            {
                "timestamp": _parse_gdelt_timestamp(article.get("seendate")),
                "source": article.get("domain") or article.get("sourcecountry") or "Unknown",
                "headline": headline or "Untitled article",
                "category": category,
                "sentiment": raw_tone,
                "raw_v2_tone": raw_tone,
                "url": url or None,
            }
        )

    hourly_tones = (
        _build_hourly_tones_from_timeline(date_str, timeline_payload or {})
        if timeline_payload
        else []
    )
    hourly_counts = (
        _build_hourly_counts_from_timeline_volraw(date_str, volume_payload or {})
        if volume_payload
        else []
    )
    if not hourly_counts or all(int(row.get("news_count") or 0) == 0 for row in hourly_counts):
        # TimelineVolRaw unavailable: fall back to ArtList counts so chart never collapses to zero.
        hourly_counts = _build_hourly_tones_from_articles(date_str, raw_articles)

    # Merge official hourly counts and official hourly tone into one 24-hour payload.
    tone_by_ts = {row["timestamp"]: row.get("average_tone") for row in hourly_tones}
    merged_hourly = []
    for row in hourly_counts:
        ts = row["timestamp"]
        merged_hourly.append(
            {
                "timestamp": ts,
                "news_count": int(row.get("news_count") or 0),
                "average_tone": tone_by_ts.get(ts),
            }
        )

    weighted_tone_sum = 0.0
    weighted_tone_n = 0
    for row in merged_hourly:
        tone = row.get("average_tone")
        count = _coerce_int(row.get("news_count"))
        if tone is None or count <= 0:
            continue
        weighted_tone_sum += float(tone) * count
        weighted_tone_n += count
    avg_tone = weighted_tone_sum / weighted_tone_n if weighted_tone_n > 0 else None
    total_news_count = sum(_coerce_int(row.get("news_count")) for row in merged_hourly)

    display_articles = articles[:DISPLAY_EVENT_RECORDS]

    return {
        "cache_schema_version": CACHE_SCHEMA_VERSION,
        "date": date_str,
        "status": "live",
        "data_quality": "full",
        "message": "Loaded selected-day headlines, TimelineTone, and TimelineVolRaw from GDELT DOC API.",
        "news_count": total_news_count if total_news_count > 0 else len(articles),
        "avg_tone": avg_tone,
        "theme_count_crypto": theme_counts["crypto"],
        "theme_count_regulation": theme_counts["regulation"],
        "theme_count_election": theme_counts["election"],
        "theme_count_war": theme_counts["war"],
        "hourly_tones": merged_hourly,
        "timeline_status": timeline_status,
        "volume_status": volume_status,
        "top_headlines": [article["headline"] for article in display_articles[:5]],
        "articles": display_articles,
        "all_articles": articles,
    }


def _fetch_from_gdelt(date_str: str) -> dict[str, Any]:
    day_start = datetime.strptime(date_str, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1) - timedelta(seconds=1)
    artlist_payload = _request_gdelt_doc(
        {
            "QUERY": DEFAULT_QUERY,
            "MODE": "ArtList",
            "FORMAT": "JSON",
            "MAXRECORDS": str(GDELT_ARTLIST_MAX_RECORDS),
            "STARTDATETIME": day_start.strftime("%Y%m%d000000"),
            "ENDDATETIME": day_end.strftime("%Y%m%d235959"),
        }
    )
    raw_articles = artlist_payload.get("articles") or []

    # Protect against API-side throttling bursts between back-to-back mode calls.
    time.sleep(2)

    timeline_payload = _request_gdelt_doc(
        {
            "QUERY": DEFAULT_QUERY,
            "MODE": "TimelineTone",
            "FORMAT": "JSON",
            "STARTDATETIME": day_start.strftime("%Y%m%d000000"),
            "ENDDATETIME": day_end.strftime("%Y%m%d235959"),
        }
    )

    # Keep calls spaced to reduce throttling and transient 429/timeout bursts.
    time.sleep(2)
    volume_payload = _request_gdelt_doc(
        {
            "QUERY": DEFAULT_QUERY,
            "MODE": "TimelineVolRaw",
            "FORMAT": "JSON",
            "STARTDATETIME": day_start.strftime("%Y%m%d000000"),
            "ENDDATETIME": day_end.strftime("%Y%m%d235959"),
        }
    )

    return _normalize_gdelt_payload(
        date_str=date_str,
        raw_articles=raw_articles,
        timeline_payload=timeline_payload,
        volume_payload=volume_payload,
        timeline_status="ok",
        volume_status="ok",
    )


def _legacy_gdelt_cache_is_usable(payload: dict[str, Any]) -> bool:
    """True if a JSON file predates cache_schema_version but still has chartable GDELT data."""
    articles = payload.get("all_articles") or payload.get("articles") or []
    if isinstance(articles, list) and len(articles) > 0:
        return True
    hourly = payload.get("hourly_tones") or []
    if isinstance(hourly, list):
        for row in hourly:
            if _coerce_int(row.get("news_count")) > 0:
                return True
    return int(payload.get("news_count") or 0) > 0


def get_selected_day_gdelt_context(date_str: str) -> dict[str, Any]:
    cache_path = _cache_path_for_date(date_str)
    if cache_path.exists():
        with cache_path.open("r", encoding="utf-8") as handle:
            cached_payload = json.load(handle)
        if (
            isinstance(cached_payload, dict)
            and cached_payload.get("cache_schema_version") == CACHE_SCHEMA_VERSION
        ):
            cached_payload["status"] = "cached"
            cached_payload["message"] = "Loaded selected-day headlines from local cache."
            return cached_payload
        # P9 / hand-curated JSON often has no cache_schema_version. Serve it for MicroView
        # instead of rejecting the date against the DOC API 90-day window.
        if isinstance(cached_payload, dict) and _legacy_gdelt_cache_is_usable(cached_payload):
            legacy = dict(cached_payload)
            legacy["status"] = "cached_legacy"
            legacy["message"] = (
                "Loaded selected-day GDELT context from local cache (legacy file format)."
            )
            return legacy

    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    today = datetime.utcnow().date()
    if target_date < today - timedelta(days=GDELT_DOC_LOOKBACK_DAYS):
        return _build_empty_payload(
            date_str,
            "unavailable_historical_range",
            "GDELT DOC API only supports a recent lookback window. This historical date needs offline archive processing.",
        )

    if target_date > today:
        return _build_empty_payload(
            date_str,
            "unavailable_future_date",
            "No event context is available for a future date.",
        )

    try:
        payload = _fetch_from_gdelt(date_str)
    except Exception as exc:
        return _build_empty_payload(
            date_str,
            "fetch_error",
            f"Failed to load GDELT selected-day context: {exc}",
        )

    with cache_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    return payload
