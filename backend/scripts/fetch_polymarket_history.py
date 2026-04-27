"""Bulk-warm the Polymarket history cache for every curated event slug.

Outputs:
- data/raw/polymarket_events/<slug>.json     (one file per curated event)
- data/raw/polymarket_history/<token>.json   (one file per YES token)
- data/derived/polymarket_history_daily.csv  (long-format daily price table)

Run this before a presentation so the dashboard is fully offline-capable.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.data_paths import POLYMARKET_HISTORY_DAILY_PATH
from backend.app.services.polymarket_curated import (
    CURATED_BUCKETS,
    infer_theme,
)
from backend.app.services.polymarket_history_service import (
    _safe_json_list,
    load_event,
    load_token_history,
)


def main(refresh: bool = True) -> None:
    rows: list[dict[str, object]] = []
    for bucket in CURATED_BUCKETS:
        if not bucket.event_slugs:
            print(f"[skip] {bucket.key}: no curated event slugs ({bucket.note})")
            continue
        print(f"[bucket] {bucket.key} — {len(bucket.event_slugs)} events")
        for slug in bucket.event_slugs:
            event = load_event(slug, refresh=refresh)
            if event is None:
                print(f"  [miss] event '{slug}' could not be fetched")
                continue
            event_title = event.get("title") or slug
            markets = event.get("markets") or []
            print(f"  [event] {slug} -> {len(markets)} markets")
            for market in markets:
                token_ids = _safe_json_list(market.get("clobTokenIds"))
                if not token_ids:
                    continue
                yes_token = str(token_ids[0])
                history = load_token_history(yes_token, refresh=refresh)
                question = market.get("question") or event_title
                theme = infer_theme(question)
                for point in history:
                    rows.append(
                        {
                            "bucket": bucket.key,
                            "event_slug": slug,
                            "market_slug": market.get("slug"),
                            "question": question,
                            "theme": theme,
                            "ts": int(point["t"]),
                            "date": datetime.fromtimestamp(
                                int(point["t"]), tz=timezone.utc
                            )
                            .date()
                            .isoformat(),
                            "yes_price": float(point["p"]),
                        }
                    )

    if not rows:
        print("[done] no rows produced — check curated buckets and connectivity")
        return

    frame = pd.DataFrame(rows)
    frame = frame.sort_values(["bucket", "market_slug", "ts"]).reset_index(drop=True)
    POLYMARKET_HISTORY_DAILY_PATH.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(POLYMARKET_HISTORY_DAILY_PATH, index=False)
    print(
        f"[done] {len(frame)} rows across "
        f"{frame['market_slug'].nunique()} markets -> "
        f"{POLYMARKET_HISTORY_DAILY_PATH}"
    )


if __name__ == "__main__":
    refresh_flag = "--refresh" in sys.argv or "-r" in sys.argv
    main(refresh=refresh_flag or True)
