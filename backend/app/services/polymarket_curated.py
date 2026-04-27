"""Curated Polymarket event slugs per case-study window.

The Gamma public-search endpoint is recency-biased and keyword-sensitive,
so for the project's case-study windows we hand-pick the relevant event
slugs. This is the only place that hard-codes anything Polymarket-specific
— `polymarket_history_service.py` consumes this map generically.

For windows where Polymarket has no useful coverage (COVID 2020, Russia
2022) the slug list is empty; the service then returns a graceful
"unavailable for this period" payload.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date as _date


@dataclass(frozen=True)
class CuratedBucket:
    key: str
    label: str
    window_start: _date
    window_end: _date
    event_slugs: tuple[str, ...]
    note: str = ""


def _d(s: str) -> _date:
    return _date.fromisoformat(s)


# ---------------------------------------------------------------------------
# Event slugs verified against gamma-api.polymarket.com on 2026-04-27.
# ---------------------------------------------------------------------------

CURATED_BUCKETS: tuple[CuratedBucket, ...] = (
    CuratedBucket(
        key="covid_shock",
        label="COVID Shock (2020)",
        window_start=_d("2020-02-01"),
        window_end=_d("2020-06-30"),
        event_slugs=(),
        note=(
            "Polymarket launched mid-2020 with low liquidity; no useful "
            "historical coverage of the COVID shock window."
        ),
    ),
    CuratedBucket(
        key="war_regime",
        label="Russia-Ukraine War Onset (2022)",
        window_start=_d("2022-02-01"),
        window_end=_d("2022-05-31"),
        event_slugs=(),
        note=(
            "Polymarket coverage of the 2022 invasion was thin and "
            "illiquid; we omit it rather than show noisy markets."
        ),
    ),
    CuratedBucket(
        key="election_cycle",
        label="US Election Cycle (2024)",
        window_start=_d("2024-09-01"),
        window_end=_d("2025-01-31"),
        event_slugs=(
            "presidential-election-winner-2024",
            "bitcoin-new-all-time-high-in-2024",
            "bitcoin-all-time-high-in-2024",
            "bitcoin-price-1hr-after-etf-approval",
        ),
    ),
    CuratedBucket(
        key="iran_tension",
        label="Iran Tension (2026)",
        window_start=_d("2026-03-01"),
        window_end=_d("2026-04-30"),
        event_slugs=(
            "us-iran-nuclear-deal-by-april-30",
            "us-iran-nuclear-deal-by-june-30",
            "iran-military-action-against-by-april-30",
            "will-trump-declare-war-on-iran-by",
            "will-the-us-officially-declare-war-on-iran-by",
            "fed-decision-in-april",
        ),
    ),
)


def find_bucket_for_date(target: _date) -> CuratedBucket | None:
    """Return the first curated bucket whose window contains `target`."""
    for bucket in CURATED_BUCKETS:
        if bucket.window_start <= target <= bucket.window_end:
            return bucket
    return None


def all_event_slugs() -> list[str]:
    """Flat list of every curated event slug across all buckets."""
    seen: list[str] = []
    for bucket in CURATED_BUCKETS:
        for slug in bucket.event_slugs:
            if slug not in seen:
                seen.append(slug)
    return seen


# Theme inference for visual grouping in the UI.
THEME_BY_KEYWORD: tuple[tuple[str, str], ...] = (
    ("nuclear", "geopolitics"),
    ("iran", "geopolitics"),
    ("war", "geopolitics"),
    ("ceasefire", "geopolitics"),
    ("strike", "geopolitics"),
    ("election", "election"),
    ("president", "election"),
    ("trump", "election"),
    ("harris", "election"),
    ("etf", "crypto"),
    ("bitcoin", "crypto"),
    ("crypto", "crypto"),
    ("fed", "fed_rates"),
    ("interest rate", "fed_rates"),
    ("rate cut", "fed_rates"),
)


def infer_theme(text: str) -> str:
    lower = (text or "").lower()
    for keyword, theme in THEME_BY_KEYWORD:
        if keyword in lower:
            return theme
    return "other"
