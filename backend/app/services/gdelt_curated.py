"""Curated GDELT query map per case-study window (P9).

The GDELT DOC API actually supports lookback well beyond a year —
verified empirically returning relevant headlines for 2020-03-12 (COVID
crash), 2022-02-24 (Russia invades Ukraine), 2024-11-05 (Trump election
day). The previous 90-day guard in `gdelt_service.py` was overly
conservative.

What was missing was **topical breadth**: the legacy `DEFAULT_QUERY`
filtered to bitcoin/crypto only, so dates inside the COVID, War, or
Election windows produced near-empty headline panels and a crypto-only
word cloud.

This module mirrors `polymarket_curated.py`: a per-window query plus a
generic fallback. `gdelt_service.py` selects the right query for the
target date.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date as _date


@dataclass(frozen=True)
class CuratedQuery:
    key: str
    label: str
    window_start: _date
    window_end: _date
    query: str
    hot_dates: tuple[str, ...] = ()  # for the bulk-warm script


def _d(s: str) -> _date:
    return _date.fromisoformat(s)


# ---------------------------------------------------------------------------
# Per-window tailored DOC API queries.
#
# Query design:
# - The DOC API uses Lucene-ish syntax: parenthesised disjunctions,
#   AND/OR/NOT, quoted phrases.
# - We intentionally include `bitcoin OR market OR fed` in every bucket
#   so the headline panel always has *something* tying back to BTC for
#   the asset chart, even on days dominated by non-financial news.
# ---------------------------------------------------------------------------


CURATED_QUERIES: tuple[CuratedQuery, ...] = (
    CuratedQuery(
        key="covid_shock",
        label="COVID Shock (2020)",
        window_start=_d("2020-02-01"),
        window_end=_d("2020-06-30"),
        query=(
            "(covid OR coronavirus OR pandemic OR \"black thursday\" "
            "OR fed OR \"federal reserve\" OR \"interest rate\" "
            "OR stimulus OR \"stock market\" OR crash OR bitcoin OR crypto)"
        ),
        hot_dates=(
            "2020-03-09",  # initial selloff
            "2020-03-11",  # WHO declares pandemic
            "2020-03-12",  # Black Thursday
            "2020-03-16",  # second crash + Fed emergency cut
            "2020-03-23",  # Fed unlimited QE
            "2020-03-27",  # CARES Act $2T
            "2020-04-09",  # Fed Main Street facility
            "2020-05-10",  # Bitcoin halving
        ),
    ),
    CuratedQuery(
        key="war_regime",
        label="Russia-Ukraine War Onset (2022)",
        window_start=_d("2022-02-01"),
        window_end=_d("2022-05-31"),
        query=(
            "(ukraine OR russia OR putin OR zelenskyy OR invasion OR war "
            "OR kyiv OR kharkiv OR sanctions OR swift OR \"central bank\" "
            "OR \"oil price\" OR bitcoin OR crypto OR ruble)"
        ),
        hot_dates=(
            "2022-02-21",  # Putin recognises DPR/LPR
            "2022-02-24",  # Russia invades Ukraine
            "2022-02-25",  # Day 2 — Kyiv encircled
            "2022-02-26",  # SWIFT cut announced
            "2022-03-04",  # Zaporizhzhia plant fire
            "2022-03-08",  # US bans Russian oil
            "2022-03-16",  # Fed first hike of cycle
            "2022-05-12",  # LUNA collapse
        ),
    ),
    CuratedQuery(
        key="election_cycle",
        label="US Election Cycle (2024)",
        window_start=_d("2024-09-01"),
        window_end=_d("2025-01-31"),
        query=(
            "(trump OR harris OR \"vice president\" OR election OR vote "
            "OR campaign OR debate OR \"white house\" OR \"swing state\" "
            "OR bitcoin OR \"spot etf\" OR crypto OR fed OR \"interest rate\")"
        ),
        hot_dates=(
            "2024-09-10",  # Harris-Trump debate
            "2024-10-07",  # one-year October 7 anniversary
            "2024-11-04",  # election eve
            "2024-11-05",  # election day
            "2024-11-06",  # Trump declared winner
            "2024-12-05",  # Bitcoin breaks $100k
            "2025-01-15",  # Bitcoin ETF anniversary
            "2025-01-20",  # Trump inauguration
        ),
    ),
    CuratedQuery(
        key="iran_tension",
        label="Iran Tension (2026)",
        window_start=_d("2026-03-01"),
        window_end=_d("2026-04-30"),
        query=(
            "(iran OR israel OR \"middle east\" OR strike OR \"nuclear deal\" "
            "OR uranium OR tehran OR netanyahu OR trump "
            "OR \"oil price\" OR bitcoin OR crypto OR fed)"
        ),
        hot_dates=(
            "2026-03-09",
            "2026-03-16",
            "2026-03-22",
            "2026-03-26",
            "2026-04-01",
            "2026-04-08",
            "2026-04-15",
            "2026-04-22",
        ),
    ),
)


# Generic broader query for dates outside any curated bucket.
GENERIC_QUERY = (
    "(bitcoin OR btc OR crypto OR \"spot etf\" OR \"federal reserve\" "
    "OR fed OR inflation OR \"interest rate\" OR \"stock market\" "
    "OR election OR war OR \"oil price\")"
)


def find_query_for_date(target: _date) -> tuple[str, CuratedQuery | None]:
    """Return (query, bucket) for `target`. bucket is None for generic."""
    for bucket in CURATED_QUERIES:
        if bucket.window_start <= target <= bucket.window_end:
            return bucket.query, bucket
    return GENERIC_QUERY, None


def all_hot_dates() -> list[tuple[str, str]]:
    """Flat list of (date_str, bucket_key) for the bulk-warm script."""
    out: list[tuple[str, str]] = []
    for bucket in CURATED_QUERIES:
        for d in bucket.hot_dates:
            out.append((d, bucket.key))
    return out
