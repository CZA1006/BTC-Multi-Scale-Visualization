from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

ROW_LIMIT = 200
REPO_ROOT = Path(__file__).resolve().parents[3]
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
DERIVED_DIR = REPO_ROOT / "data" / "derived"
BTC_DAILY_PATH = PROCESSED_DIR / "btc_daily.csv"
EXTERNAL_ASSETS_PATH = PROCESSED_DIR / "external_assets_daily.csv"
GDELT_DAILY_SIGNALS_PATH = DERIVED_DIR / "gdelt_daily_signals.csv"

router = APIRouter(prefix="/api/overview", tags=["overview"])


def _sample_frame(frame: pd.DataFrame, row_limit: int) -> pd.DataFrame:
    if len(frame) <= row_limit:
        return frame
    if row_limit <= 1:
        return frame.tail(1)

    max_index = len(frame) - 1
    sample_indices = sorted(
        {
            round(position * max_index / (row_limit - 1))
            for position in range(row_limit)
        }
    )
    return frame.iloc[sample_indices]


def load_csv_records(
    path: Path,
    row_limit: int = ROW_LIMIT,
    start: date | None = None,
    end: date | None = None,
) -> list[dict[str, Any]]:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Data file not found: {path.name}")

    try:
        frame = pd.read_csv(path)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to load data file: {path.name}"
        ) from exc

    if "date" in frame.columns:
        frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
        frame = frame.dropna(subset=["date"])

        if start is not None:
            frame = frame.loc[frame["date"] >= pd.Timestamp(start)]
        if end is not None:
            frame = frame.loc[frame["date"] <= pd.Timestamp(end)]

    sort_columns = [column for column in ("date", "ticker") if column in frame.columns]
    if sort_columns:
        frame = frame.sort_values(sort_columns).reset_index(drop=True)

    limited = _sample_frame(frame, row_limit).copy()

    if "date" in limited.columns:
        limited["date"] = limited["date"].dt.strftime("%Y-%m-%d")

    limited = limited.where(pd.notna(limited), None)
    return limited.to_dict(orient="records")


def load_optional_csv_records(
    path: Path,
    row_limit: int = ROW_LIMIT,
    start: date | None = None,
    end: date | None = None,
) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return load_csv_records(path, row_limit=row_limit, start=start, end=end)


@router.get("")
def get_overview(start: date | None = None, end: date | None = None) -> dict[str, Any]:
    return {
        "row_limit": ROW_LIMIT,
        "requested_range": {
            "start": start.isoformat() if start else None,
            "end": end.isoformat() if end else None,
        },
        "btc_daily": load_csv_records(BTC_DAILY_PATH, start=start, end=end),
        "external_assets_daily": load_csv_records(
            EXTERNAL_ASSETS_PATH, start=start, end=end
        ),
        "gdelt_daily_signals": load_optional_csv_records(
            GDELT_DAILY_SIGNALS_PATH, start=start, end=end
        ),
    }
