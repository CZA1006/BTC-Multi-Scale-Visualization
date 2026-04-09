from __future__ import annotations

import math
from datetime import date

import pandas as pd

from ..schemas.overview import (
    AssetSnapshot,
    CalendarCell,
    OverviewMetadata,
    OverviewResponse,
    OverviewSummary,
    TimelinePoint,
)
from .data_paths import BTC_DAILY_PATH, EXTERNAL_ASSETS_DAILY_PATH


def _safe_float(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)


def _build_placeholder_btc_daily() -> pd.DataFrame:
    dates = pd.date_range("2024-01-01", periods=180, freq="D")
    closes = []
    volumes = []
    base_price = 42000.0

    for index, current_date in enumerate(dates):
        trend = index * 85
        wave = math.sin(index / 8) * 2200
        close = base_price + trend + wave
        closes.append(close)
        volumes.append(18_000_000_000 + (math.cos(index / 5) + 1.2) * 1_800_000_000)

    frame = pd.DataFrame({"date": dates, "close": closes, "volume": volumes})
    frame["daily_return"] = frame["close"].pct_change()
    rolling_peak = frame["close"].cummax()
    frame["drawdown"] = (frame["close"] - rolling_peak) / rolling_peak
    return frame


def _build_placeholder_assets() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"ticker": "COIN", "close": 215.4, "daily_return": 0.014, "volume": 12_500_000},
            {"ticker": "MSTR", "close": 1688.2, "daily_return": 0.021, "volume": 9_200_000},
            {"ticker": "QQQ", "close": 486.7, "daily_return": 0.004, "volume": 42_100_000},
        ]
    )


def load_btc_daily() -> tuple[pd.DataFrame, bool]:
    if BTC_DAILY_PATH.exists():
        frame = pd.read_csv(BTC_DAILY_PATH, parse_dates=["date"]).sort_values("date")
        return frame, False
    return _build_placeholder_btc_daily(), True


def load_asset_snapshots() -> tuple[pd.DataFrame, bool]:
    if EXTERNAL_ASSETS_DAILY_PATH.exists():
        frame = pd.read_csv(EXTERNAL_ASSETS_DAILY_PATH, parse_dates=["date"]).sort_values(
            ["ticker", "date"]
        )
        latest = frame.groupby("ticker", as_index=False).tail(1)
        return latest, False
    return _build_placeholder_assets(), True


def build_overview_response(
    start: date | None = None, end: date | None = None
) -> OverviewResponse:
    btc_daily, btc_placeholder = load_btc_daily()
    assets, assets_placeholder = load_asset_snapshots()

    filtered = btc_daily.copy()
    if start is not None:
        filtered = filtered.loc[filtered["date"] >= pd.Timestamp(start)]
    if end is not None:
        filtered = filtered.loc[filtered["date"] <= pd.Timestamp(end)]
    filtered = filtered.reset_index(drop=True)

    if filtered.empty:
        filtered = btc_daily.copy().reset_index(drop=True)

    calendar_frame = filtered.copy()
    calendar_frame["year"] = calendar_frame["date"].dt.year
    calendar_frame["month"] = calendar_frame["date"].dt.month
    calendar_frame["week"] = calendar_frame["date"].dt.strftime("%U").astype(int)
    calendar_frame["weekday"] = calendar_frame["date"].dt.weekday

    first_close = filtered.iloc[0]["close"]
    last_row = filtered.iloc[-1]
    summary = OverviewSummary(
        latest_close=float(last_row["close"]),
        latest_daily_return=_safe_float(last_row.get("daily_return")),
        period_return=_safe_float((last_row["close"] - first_close) / first_close),
        max_drawdown=_safe_float(filtered.get("drawdown", pd.Series(dtype=float)).min()),
    )

    metadata = OverviewMetadata(
        data_source="local_csv" if not btc_placeholder else "placeholder",
        start_date=filtered.iloc[0]["date"].date(),
        end_date=filtered.iloc[-1]["date"].date(),
        total_points=len(filtered),
        uses_placeholder=btc_placeholder or assets_placeholder,
    )

    series = [
        TimelinePoint(
            date=row.date.date(),
            close=float(row.close),
            volume=_safe_float(row.volume),
            daily_return=_safe_float(row.daily_return),
            drawdown=_safe_float(getattr(row, "drawdown", None)),
        )
        for row in filtered.itertuples(index=False)
    ]

    calendar = [
        CalendarCell(
            date=row.date.date(),
            year=int(row.year),
            month=int(row.month),
            week=int(row.week),
            weekday=int(row.weekday),
            close=float(row.close),
            daily_return=_safe_float(row.daily_return),
        )
        for row in calendar_frame.itertuples(index=False)
    ]

    asset_snapshots = [
        AssetSnapshot(
            ticker=str(row.ticker),
            latest_close=_safe_float(row.close),
            latest_daily_return=_safe_float(row.daily_return),
            latest_volume=_safe_float(row.volume),
        )
        for row in assets.itertuples(index=False)
    ]

    return OverviewResponse(
        metadata=metadata,
        summary=summary,
        series=series,
        calendar=calendar,
        assets=asset_snapshots,
    )
