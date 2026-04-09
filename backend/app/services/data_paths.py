from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"
PROCESSED_DIR = DATA_DIR / "processed"
DERIVED_DIR = DATA_DIR / "derived"

BTC_DAILY_PATH = PROCESSED_DIR / "btc_daily.csv"
EXTERNAL_ASSETS_DAILY_PATH = PROCESSED_DIR / "external_assets_daily.csv"
