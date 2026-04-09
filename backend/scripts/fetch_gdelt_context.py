"""Fetch recent GDELT event context and build a daily signal table.

This script is intentionally scoped to the GDELT DOC API's recent lookback window.
It can:
- warm the selected-day cache under `data/raw/gdelt_selected_day/`
- build `data/derived/gdelt_daily_signals.csv`

Default behavior:
- fetch the last 30 days ending today

Examples:
- python3 backend/scripts/fetch_gdelt_context.py
- python3 backend/scripts/fetch_gdelt_context.py --days 14
- python3 backend/scripts/fetch_gdelt_context.py --start 2026-03-01 --end 2026-04-09
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.data_paths import GDELT_DAILY_SIGNALS_PATH
from backend.app.services.gdelt_service import (
    GDELT_DOC_LOOKBACK_DAYS,
    get_selected_day_gdelt_context,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch recent GDELT selected-day context and derive daily signals."
    )
    parser.add_argument("--start", type=str, help="Start date in YYYY-MM-DD format.")
    parser.add_argument("--end", type=str, help="End date in YYYY-MM-DD format.")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of recent days to fetch when start/end are not provided.",
    )
    return parser.parse_args()


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def resolve_date_range(args: argparse.Namespace) -> tuple[date, date]:
    today = datetime.now(UTC).date()
    end_date = parse_iso_date(args.end) or today
    start_date = parse_iso_date(args.start)

    if start_date is None:
        lookback_days = max(1, args.days)
        start_date = end_date - timedelta(days=lookback_days - 1)

    if start_date > end_date:
        raise ValueError("Start date must be on or before end date.")

    earliest_supported = today - timedelta(days=GDELT_DOC_LOOKBACK_DAYS)
    if end_date < earliest_supported:
        raise ValueError(
            "Requested range is fully outside the recent GDELT DOC API window. "
            "Use a newer end date or implement offline archive extraction."
        )

    if start_date < earliest_supported:
        print(
            "[warn] Requested start date is older than the GDELT DOC recent window. "
            f"Clamping start to {earliest_supported.isoformat()}."
        )
        start_date = earliest_supported

    if end_date > today:
        print(
            "[warn] Requested end date is in the future. "
            f"Clamping end to {today.isoformat()}."
        )
        end_date = today

    return start_date, end_date


def iter_dates(start_date: date, end_date: date) -> list[date]:
    day_count = (end_date - start_date).days + 1
    return [start_date + timedelta(days=offset) for offset in range(day_count)]


def build_signal_row(payload: dict[str, object]) -> dict[str, object]:
    return {
        "date": payload.get("date"),
        "news_count": int(payload.get("news_count") or 0),
        "avg_tone": None,
        "theme_count_crypto": int(payload.get("theme_count_crypto") or 0),
        "theme_count_regulation": int(payload.get("theme_count_regulation") or 0),
        "theme_count_election": int(payload.get("theme_count_election") or 0),
        "theme_count_war": int(payload.get("theme_count_war") or 0),
        "top_headlines": json.dumps(payload.get("top_headlines") or [], ensure_ascii=False),
        "status": payload.get("status"),
        "message": payload.get("message"),
    }


def save_daily_signals(frame: pd.DataFrame) -> None:
    GDELT_DAILY_SIGNALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(GDELT_DAILY_SIGNALS_PATH, index=False)


def main() -> None:
    args = parse_args()
    start_date, end_date = resolve_date_range(args)

    signal_rows: list[dict[str, object]] = []
    for current_date in iter_dates(start_date, end_date):
        date_str = current_date.isoformat()
        payload = get_selected_day_gdelt_context(date_str)
        signal_rows.append(build_signal_row(payload))
        print(
            f"[gdelt] {date_str} -> {payload.get('status')} "
            f"({payload.get('news_count', 0)} headlines)"
        )

    signal_frame = pd.DataFrame(signal_rows).sort_values("date").reset_index(drop=True)
    save_daily_signals(signal_frame)
    print(f"Saved {len(signal_frame)} rows -> {GDELT_DAILY_SIGNALS_PATH}")


if __name__ == "__main__":
    main()
