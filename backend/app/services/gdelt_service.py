from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import requests

from .data_paths import GDELT_SELECTED_DAY_DIR
from .gdelt_curated import GENERIC_QUERY, find_query_for_date

GDELT_DOC_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
# DOC API actually returns useful results several years back; keep a large
# guard only to reject absurd/future dates.
GDELT_DOC_LOOKBACK_DAYS = 365 * 8
MAX_EVENT_RECORDS = 15

# Broad keyword map for theme inference. Order matters: first match wins.
# Geopolitics first so Iran-news outside the iran_tension window still
# surfaces as `war`/geopolitics (not as `crypto` because the article happens
# to mention bitcoin in a sidebar).
CATEGORY_KEYWORDS = {
    "war": [
        "war",
        "ukraine",
        "russia",
        "putin",
        "iran",
        "israel",
        "tehran",
        "missile",
        "strike",
        "invasion",
        "conflict",
        "nuclear",
    ],
    "election": [
        "election",
        "trump",
        "harris",
        "biden",
        "white house",
        "campaign",
        "vote",
        "debate",
        "swing state",
    ],
    "covid": [
        "covid",
        "coronavirus",
        "pandemic",
        "lockdown",
        "vaccine",
    ],
    "regulation": [
        "sec",
        "regulation",
        "regulatory",
        "lawsuit",
        "policy",
        "ban",
        "sanction",
        "swift",
    ],
    "macro": [
        "fed",
        "federal reserve",
        "inflation",
        "rate",
        "rates",
        "cpi",
        "powell",
        "stimulus",
        "qe",
    ],
    "crypto": [
        "bitcoin",
        "btc",
        "crypto",
        "cryptocurrency",
        "blockchain",
        "etf",
        "coinbase",
        "microstrategy",
    ],
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
    direct_tone = article.get("tone")
    if direct_tone is not None and str(direct_tone).strip() != "":
        try:
            return float(direct_tone)
        except (TypeError, ValueError):
            pass

    v2tone = article.get("v2tone")
    if v2tone is not None and str(v2tone).strip() != "":
        first_value = str(v2tone).split(",")[0].strip()
        try:
            return float(first_value)
        except (TypeError, ValueError):
            pass
    return None


def _build_hourly_tones(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"news_count": 0, "tone_acc": 0.0, "tone_n": 0}
    )
    for article in articles:
        timestamp = article.get("timestamp")
        if not timestamp:
            continue
        parsed = datetime.fromisoformat(str(timestamp))
        hour_key = parsed.replace(minute=0, second=0, microsecond=0).isoformat()
        tone = article.get("sentiment")
        bucket = buckets[hour_key]
        bucket["news_count"] += 1
        if tone is not None:
            bucket["tone_acc"] += float(tone)
            bucket["tone_n"] += 1

    hourly_rows: list[dict[str, Any]] = []
    for hour, aggregate in sorted(buckets.items(), key=lambda item: item[0]):
        tone_n = int(aggregate["tone_n"])
        average_tone = float(aggregate["tone_acc"]) / tone_n if tone_n > 0 else None
        hourly_rows.append(
            {
                "timestamp": hour,
                "news_count": int(aggregate["news_count"]),
                "average_tone": average_tone,
            }
        )
    return hourly_rows


def _build_empty_payload(date_str: str, status: str, message: str) -> dict[str, Any]:
    return {
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


def _normalize_gdelt_articles(
    date_str: str,
    payload: dict[str, Any],
    *,
    bucket_key: str | None = None,
    bucket_label: str | None = None,
    query_used: str | None = None,
) -> dict[str, Any]:
    raw_articles = payload.get("articles") or []
    articles: list[dict[str, Any]] = []
    theme_counts: dict[str, int] = {key: 0 for key in CATEGORY_KEYWORDS.keys()}

    for article in raw_articles[:MAX_EVENT_RECORDS]:
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
                "url": url or None,
            }
        )

    tone_values = [article["sentiment"] for article in articles if article.get("sentiment") is not None]
    avg_tone = sum(tone_values) / len(tone_values) if tone_values else None

    return {
        "date": date_str,
        "status": "live",
        "message": "Loaded selected-day headlines from GDELT DOC API.",
        "bucket": bucket_key,
        "bucket_label": bucket_label,
        "query": query_used,
        "news_count": len(articles),
        "avg_tone": avg_tone,
        "theme_count_crypto": theme_counts.get("crypto", 0),
        "theme_count_regulation": theme_counts.get("regulation", 0),
        "theme_count_election": theme_counts.get("election", 0),
        "theme_count_war": theme_counts.get("war", 0),
        "theme_count_macro": theme_counts.get("macro", 0),
        "theme_count_covid": theme_counts.get("covid", 0),
        "hourly_tones": _build_hourly_tones(articles),
        "top_headlines": [article["headline"] for article in articles[:5]],
        "articles": articles,
    }


def _fetch_from_gdelt(date_str: str) -> dict[str, Any]:
    day_start = datetime.strptime(date_str, "%Y-%m-%d")
    day_end = day_start + timedelta(days=1) - timedelta(seconds=1)

    target_date = day_start.date()
    query, bucket = find_query_for_date(target_date)

    response = requests.get(
        GDELT_DOC_API_URL,
        params={
            "QUERY": query,
            "MODE": "ArtList",
            "FORMAT": "JSON",
            "MAXRECORDS": str(MAX_EVENT_RECORDS),
            "STARTDATETIME": day_start.strftime("%Y%m%d000000"),
            "ENDDATETIME": day_end.strftime("%Y%m%d235959"),
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    return _normalize_gdelt_articles(
        date_str,
        payload,
        bucket_key=bucket.key if bucket else None,
        bucket_label=bucket.label if bucket else None,
        query_used=query,
    )


def get_selected_day_gdelt_context(date_str: str) -> dict[str, Any]:
    cache_path = _cache_path_for_date(date_str)
    if cache_path.exists():
        with cache_path.open("r", encoding="utf-8") as handle:
            cached_payload = json.load(handle)
        cached_payload["status"] = "cached"
        cached_payload["message"] = "Loaded selected-day headlines from local cache."
        return cached_payload

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
