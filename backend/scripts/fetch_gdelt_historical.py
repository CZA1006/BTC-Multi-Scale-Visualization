"""Bulk-warm the GDELT cache for every curated case-study window (P9).

For each `CuratedQuery` in `gdelt_curated.py`, this script iterates either
the explicit `hot_dates` (default) or every day in the window (`--full`)
and pre-fetches the GDELT DOC API result, writing one JSON cache file per
day under `data/raw/gdelt_selected_day/<YYYY-MM-DD>.json`.

Run modes:
    python3 backend/scripts/fetch_gdelt_historical.py            # hot dates only (~32 calls)
    python3 backend/scripts/fetch_gdelt_historical.py --full      # every day in every window (~480 calls)
    python3 backend/scripts/fetch_gdelt_historical.py --refresh   # ignore existing cache
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import date as _date
from datetime import timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.data_paths import (
    GDELT_DAILY_SIGNALS_PATH,
    GDELT_SELECTED_DAY_DIR,
)
from backend.app.services.gdelt_curated import CURATED_QUERIES
from backend.app.services.gdelt_service import (
    _fetch_from_gdelt,
    _build_empty_payload,
)
import csv
import json


def _cache_path(date_str: str) -> Path:
    GDELT_SELECTED_DAY_DIR.mkdir(parents=True, exist_ok=True)
    return GDELT_SELECTED_DAY_DIR / f"{date_str}.json"


def _iter_window_days(start: _date, end: _date):
    cur = start
    while cur <= end:
        yield cur
        cur = cur + timedelta(days=1)


def _save_payload(date_str: str, payload: dict) -> None:
    cache_path = _cache_path(date_str)
    with cache_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


_DAILY_SIGNAL_FIELDS = [
    "date",
    "news_count",
    "avg_tone",
    "theme_count_crypto",
    "theme_count_regulation",
    "theme_count_election",
    "theme_count_war",
    "theme_count_macro",
    "theme_count_covid",
    "bucket",
    "bucket_label",
    "top_headlines",
    "status",
    "message",
]


def rebuild_daily_signals() -> int:
    """Walk every cached per-day JSON and re-emit `gdelt_daily_signals.csv`.

    The Macro view's news-count timeline + event-dot indicator both read
    from this CSV. Without it, days inside the COVID/War/Election windows
    look empty even when the per-day cache is populated.
    """
    rows: list[dict] = []
    for path in sorted(GDELT_SELECTED_DAY_DIR.glob("*.json")):
        try:
            with path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:  # noqa: BLE001
            continue
        # Skip stale fetch_error rows — they have nothing useful for signals.
        if payload.get("status") == "fetch_error":
            continue
        rows.append({
            "date": payload.get("date") or path.stem,
            "news_count": int(payload.get("news_count") or 0),
            "avg_tone": payload.get("avg_tone"),
            "theme_count_crypto": int(payload.get("theme_count_crypto") or 0),
            "theme_count_regulation": int(payload.get("theme_count_regulation") or 0),
            "theme_count_election": int(payload.get("theme_count_election") or 0),
            "theme_count_war": int(payload.get("theme_count_war") or 0),
            "theme_count_macro": int(payload.get("theme_count_macro") or 0),
            "theme_count_covid": int(payload.get("theme_count_covid") or 0),
            "bucket": payload.get("bucket"),
            "bucket_label": payload.get("bucket_label"),
            "top_headlines": json.dumps(
                payload.get("top_headlines") or [], ensure_ascii=False
            ),
            "status": payload.get("status"),
            "message": payload.get("message"),
        })

    rows.sort(key=lambda r: r["date"])
    GDELT_DAILY_SIGNALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with GDELT_DAILY_SIGNALS_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=_DAILY_SIGNAL_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--full",
        action="store_true",
        help="Fetch every day in every curated window (slow).",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Ignore existing cache and re-fetch.",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.7,
        help="Seconds between API calls (rate-limit friendly).",
    )
    parser.add_argument(
        "--rebuild-signals",
        action="store_true",
        help="Skip fetching; only rebuild data/derived/gdelt_daily_signals.csv from cache.",
    )
    args = parser.parse_args()

    if args.rebuild_signals:
        n = rebuild_daily_signals()
        print(f"[done] rebuilt gdelt_daily_signals.csv with {n} rows")
        return

    n_total = 0
    n_ok = 0
    n_skip_cached = 0
    n_empty = 0

    for bucket in CURATED_QUERIES:
        if args.full:
            dates = [d.isoformat() for d in _iter_window_days(bucket.window_start, bucket.window_end)]
        else:
            dates = list(bucket.hot_dates)

        if not dates:
            print(f"[skip] {bucket.key}: no dates configured")
            continue

        print(f"\n[bucket] {bucket.label} — {len(dates)} dates")
        for date_str in dates:
            n_total += 1
            cache_path = _cache_path(date_str)
            if cache_path.exists() and not args.refresh:
                n_skip_cached += 1
                print(f"  [skip] {date_str} (cached)")
                continue

            try:
                payload = _fetch_from_gdelt(date_str)
                fetch_failed = False
            except Exception as exc:  # noqa: BLE001
                payload = _build_empty_payload(
                    date_str,
                    "fetch_error",
                    f"Bulk fetch failed: {exc}",
                )
                fetch_failed = True

            article_count = len(payload.get("articles") or [])
            if fetch_failed:
                n_empty += 1
                # Do NOT cache fetch errors — the runtime path will retry
                # the date later when rate limits have cleared.
                print(f"  [error] {date_str}: {payload.get('message','')[:80]}")
            elif article_count == 0:
                n_empty += 1
                print(f"  [empty] {date_str}: 0 articles ({payload.get('status')})")
                _save_payload(date_str, payload)
            else:
                n_ok += 1
                top = (payload.get("top_headlines") or ["(no headline)"])[0]
                print(f"  [ok]    {date_str}: {article_count} articles · {top[:60]}")
                _save_payload(date_str, payload)

            time.sleep(args.sleep)

    print(
        f"\n[done] {n_total} total · {n_ok} ok · {n_skip_cached} cached · "
        f"{n_empty} empty"
    )

    n_signals = rebuild_daily_signals()
    print(f"[signals] rebuilt gdelt_daily_signals.csv with {n_signals} rows")


if __name__ == "__main__":
    main()
