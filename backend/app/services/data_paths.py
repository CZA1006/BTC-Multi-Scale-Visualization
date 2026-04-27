from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
DERIVED_DIR = DATA_DIR / "derived"

BTC_DAILY_PATH = PROCESSED_DIR / "btc_daily.csv"
EXTERNAL_ASSETS_DAILY_PATH = PROCESSED_DIR / "external_assets_daily.csv"
GDELT_SELECTED_DAY_DIR = RAW_DIR / "gdelt_selected_day"
POLYMARKET_SELECTED_DAY_DIR = RAW_DIR / "polymarket_selected_day"
POLYMARKET_EVENTS_DIR = RAW_DIR / "polymarket_events"
POLYMARKET_HISTORY_DIR = RAW_DIR / "polymarket_history"
GDELT_DAILY_SIGNALS_PATH = DERIVED_DIR / "gdelt_daily_signals.csv"
POLYMARKET_DAILY_PATH = DERIVED_DIR / "polymarket_daily.csv"
POLYMARKET_HISTORY_DAILY_PATH = DERIVED_DIR / "polymarket_history_daily.csv"
