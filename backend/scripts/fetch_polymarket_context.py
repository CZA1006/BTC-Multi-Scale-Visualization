"""Fetch a minimal current Polymarket context snapshot.

Outputs:
- data/raw/polymarket_selected_day/YYYY-MM-DD.json
- data/derived/polymarket_daily.csv
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.data_paths import POLYMARKET_DAILY_PATH
from backend.app.services.polymarket_service import get_current_polymarket_context


def save_polymarket_daily(snapshot: dict[str, object]) -> pd.DataFrame:
    rows = []
    for market in snapshot.get("markets", []):
        rows.append(
            {
                "date": snapshot.get("as_of_date"),
                "market_slug": market.get("market_slug"),
                "market_name": market.get("market_name"),
                "probability": market.get("yes_price"),
                "volume": market.get("volume"),
                "theme": market.get("theme"),
                "source_query": market.get("source_query"),
                "status": snapshot.get("status"),
            }
        )

    frame = pd.DataFrame(rows)
    if POLYMARKET_DAILY_PATH.exists():
        existing = pd.read_csv(POLYMARKET_DAILY_PATH)
        frame = pd.concat([existing, frame], ignore_index=True)
        frame = frame.drop_duplicates(subset=["date", "market_slug"], keep="last")

    POLYMARKET_DAILY_PATH.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(POLYMARKET_DAILY_PATH, index=False)
    return frame


def main() -> None:
    snapshot = get_current_polymarket_context()
    frame = save_polymarket_daily(snapshot)
    print(
        f"[polymarket] {snapshot.get('status')} -> {len(snapshot.get('markets', []))} markets"
    )
    print(f"Saved {len(frame)} rows -> {POLYMARKET_DAILY_PATH}")


if __name__ == "__main__":
    main()
