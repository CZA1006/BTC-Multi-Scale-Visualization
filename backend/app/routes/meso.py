from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

REPO_ROOT = Path(__file__).resolve().parents[3]
DERIVED_DIR = REPO_ROOT / "data" / "derived"
DAILY_FEATURES_PATH = DERIVED_DIR / "daily_features.csv"
EMBEDDING_RESULTS_PATH = DERIVED_DIR / "embedding_results.csv"

router = APIRouter(prefix="/api/meso", tags=["meso"])


def load_csv_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Data file not found: {path.name}")

    try:
        frame = pd.read_csv(path)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to load data file: {path.name}"
        ) from exc

    frame = frame.where(pd.notna(frame), None)
    return frame.to_dict(orient="records")


@router.get("")
def get_meso() -> dict[str, Any]:
    daily_features = load_csv_records(DAILY_FEATURES_PATH)
    embedding_results = load_csv_records(EMBEDDING_RESULTS_PATH)

    return {
        "daily_features": daily_features,
        "embedding_results": embedding_results,
    }
