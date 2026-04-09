"""Build round-1 BTC daily features for the meso view.

Input:
- data/processed/btc_daily.csv

Output:
- data/derived/daily_features.csv

Computed features:
- daily_return
- open_close_change
- high_low_range
- volume_zscore
- rolling_volatility_7d
- rolling_volatility_30d
- drawdown_from_30d_high
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
DERIVED_DIR = REPO_ROOT / "data" / "derived"
DERIVED_DIR.mkdir(parents=True, exist_ok=True)

BTC_DAILY_PATH = PROCESSED_DIR / "btc_daily.csv"
FEATURES_OUTPUT_PATH = DERIVED_DIR / "daily_features.csv"

REQUIRED_COLUMNS = ["date", "open", "high", "low", "close", "volume"]


def load_btc_daily(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Expected input file: {path}")

    frame = pd.read_csv(path)
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns in btc_daily.csv: {missing_columns}")

    frame = frame.copy()
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame = frame.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)

    for column in REQUIRED_COLUMNS[1:]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame = frame.dropna(subset=["open", "high", "low", "close", "volume"]).reset_index(
        drop=True
    )
    return frame


def compute_volume_zscore(volume: pd.Series) -> pd.Series:
    mean = volume.mean()
    std = volume.std(ddof=0)
    if pd.isna(std) or std == 0:
        return pd.Series([0.0] * len(volume), index=volume.index, dtype="float64")
    return (volume - mean) / std


def build_daily_features(btc_daily: pd.DataFrame) -> pd.DataFrame:
    features = btc_daily.copy()

    features["daily_return"] = features["close"].pct_change()
    features["open_close_change"] = (features["close"] - features["open"]) / features["open"]
    features["high_low_range"] = (features["high"] - features["low"]) / features["open"]
    features["volume_zscore"] = compute_volume_zscore(features["volume"])
    features["rolling_volatility_7d"] = features["daily_return"].rolling(window=7).std()
    features["rolling_volatility_30d"] = features["daily_return"].rolling(window=30).std()

    rolling_30d_high = features["close"].rolling(window=30, min_periods=1).max()
    features["drawdown_from_30d_high"] = (
        features["close"] - rolling_30d_high
    ) / rolling_30d_high

    output = features[
        [
            "date",
            "daily_return",
            "open_close_change",
            "high_low_range",
            "volume_zscore",
            "rolling_volatility_7d",
            "rolling_volatility_30d",
            "drawdown_from_30d_high",
        ]
    ].copy()

    output["date"] = output["date"].dt.strftime("%Y-%m-%d")
    return output


def save_features(frame: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)


def main() -> None:
    btc_daily = load_btc_daily(BTC_DAILY_PATH)
    features = build_daily_features(btc_daily)
    save_features(features, FEATURES_OUTPUT_PATH)
    print(f"Saved {len(features)} rows -> {FEATURES_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
