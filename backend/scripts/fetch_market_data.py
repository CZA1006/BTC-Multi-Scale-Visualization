"""Fetch round-1 daily market data with yfinance.

This script downloads:
- BTC-USD
- COIN
- MSTR
- QQQ

Outputs:
- data/processed/btc_daily.csv
- data/processed/btc_intraday.csv
- data/processed/external_assets_daily.csv
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import yfinance as yf

START_DATE = "2019-01-01"
END_DATE = "2026-04-30"
BTC_TICKER = "BTC-USD"
EXTERNAL_TICKERS = ("COIN", "MSTR", "QQQ")
INTRADAY_LOOKBACK_DAYS = 729
INTRADAY_INTERVAL = "60m"

REPO_ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
BTC_OUTPUT_PATH = PROCESSED_DIR / "btc_daily.csv"
BTC_INTRADAY_OUTPUT_PATH = PROCESSED_DIR / "btc_intraday.csv"
EXTERNAL_OUTPUT_PATH = PROCESSED_DIR / "external_assets_daily.csv"

PRICE_COLUMNS = ("open", "high", "low", "close", "volume")


@dataclass(frozen=True)
class MarketDownload:
    ticker: str
    frame: pd.DataFrame


def to_snake_case(value: object) -> str:
    return str(value).strip().lower().replace(" ", "_").replace("-", "_")


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    normalized = frame.copy().reset_index()
    if isinstance(normalized.columns, pd.MultiIndex):
        normalized.columns = [
            column[0] if column[0] and column[0] != "Price" else column[-1]
            for column in normalized.columns.to_flat_index()
        ]

    normalized.columns = [to_snake_case(column) for column in normalized.columns]
    if "adj_close" in normalized.columns:
        normalized = normalized.drop(columns=["adj_close"])
    return normalized


def clean_ohlcv_frame(frame: pd.DataFrame) -> pd.DataFrame:
    cleaned = normalize_columns(frame)

    required_columns = ["date", *PRICE_COLUMNS]
    missing_columns = [column for column in required_columns if column not in cleaned.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    cleaned["date"] = pd.to_datetime(cleaned["date"], errors="coerce")
    cleaned = cleaned.dropna(subset=["date"]).copy()

    for column in PRICE_COLUMNS:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")

    cleaned["volume"] = cleaned["volume"].fillna(0)
    cleaned = cleaned.dropna(subset=["open", "high", "low", "close"])
    cleaned = cleaned.sort_values("date").reset_index(drop=True)
    cleaned["date"] = cleaned["date"].dt.strftime("%Y-%m-%d")

    return cleaned[required_columns]


def clean_intraday_frame(frame: pd.DataFrame) -> pd.DataFrame:
    cleaned = normalize_columns(frame)

    timestamp_column = "datetime" if "datetime" in cleaned.columns else "date"
    required_columns = [timestamp_column, *PRICE_COLUMNS]
    missing_columns = [column for column in required_columns if column not in cleaned.columns]
    if missing_columns:
        raise ValueError(f"Missing required intraday columns: {missing_columns}")

    cleaned[timestamp_column] = pd.to_datetime(cleaned[timestamp_column], errors="coerce")
    cleaned = cleaned.dropna(subset=[timestamp_column]).copy()

    for column in PRICE_COLUMNS:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")

    cleaned["volume"] = cleaned["volume"].fillna(0)
    cleaned = cleaned.dropna(subset=["open", "high", "low", "close"])
    cleaned = cleaned.sort_values(timestamp_column).reset_index(drop=True)
    cleaned = cleaned.rename(columns={timestamp_column: "timestamp"})
    cleaned["timestamp"] = cleaned["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")
    cleaned["trade_date"] = cleaned["timestamp"].str.slice(0, 10)

    return cleaned[["timestamp", "open", "high", "low", "close", "volume", "trade_date"]]


def download_daily_history(ticker: str) -> MarketDownload:
    # yfinance treats `end` as exclusive, so add one day to include 2026-04-30.
    download_end = (pd.Timestamp(END_DATE) + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    frame = yf.download(
        ticker,
        start=START_DATE,
        end=download_end,
        interval="1d",
        auto_adjust=False,
        actions=False,
        progress=False,
    )
    if frame.empty:
        raise ValueError(f"No daily data returned for {ticker}")
    return MarketDownload(ticker=ticker, frame=clean_ohlcv_frame(frame))


def download_btc_intraday_history(ticker: str) -> pd.DataFrame:
    intraday_start = (
        pd.Timestamp.today().normalize() - pd.Timedelta(days=INTRADAY_LOOKBACK_DAYS)
    ).strftime("%Y-%m-%d")
    intraday_end = (pd.Timestamp.today().normalize() + pd.Timedelta(days=1)).strftime(
        "%Y-%m-%d"
    )
    frame = yf.download(
        ticker,
        start=intraday_start,
        end=intraday_end,
        interval=INTRADAY_INTERVAL,
        auto_adjust=False,
        actions=False,
        progress=False,
    )
    if frame.empty:
        return pd.DataFrame(
            columns=["timestamp", "open", "high", "low", "close", "volume", "trade_date"]
        )
    return clean_intraday_frame(frame)


def build_btc_daily(download: MarketDownload) -> pd.DataFrame:
    return download.frame.copy()[["date", "open", "high", "low", "close", "volume"]]


def build_external_assets_daily(downloads: list[MarketDownload]) -> pd.DataFrame:
    asset_frames: list[pd.DataFrame] = []

    for download in downloads:
        asset_frame = download.frame.copy()
        asset_frame["ticker"] = download.ticker
        asset_frame["daily_return"] = asset_frame["close"].pct_change()
        asset_frames.append(
            asset_frame[
                ["date", "ticker", "open", "high", "low", "close", "volume", "daily_return"]
            ]
        )

    combined = pd.concat(asset_frames, ignore_index=True)
    combined = combined.sort_values(["date", "ticker"]).reset_index(drop=True)
    return combined


def save_csv(frame: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)


def main() -> None:
    btc_download = download_daily_history(BTC_TICKER)
    external_downloads = [download_daily_history(ticker) for ticker in EXTERNAL_TICKERS]
    btc_intraday = download_btc_intraday_history(BTC_TICKER)

    btc_daily = build_btc_daily(btc_download)
    external_assets_daily = build_external_assets_daily(external_downloads)

    save_csv(btc_daily, BTC_OUTPUT_PATH)
    save_csv(btc_intraday, BTC_INTRADAY_OUTPUT_PATH)
    save_csv(external_assets_daily, EXTERNAL_OUTPUT_PATH)

    print(f"Saved {len(btc_daily)} rows -> {BTC_OUTPUT_PATH}")
    print(f"Saved {len(btc_intraday)} rows -> {BTC_INTRADAY_OUTPUT_PATH}")
    print(f"Saved {len(external_assets_daily)} rows -> {EXTERNAL_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
