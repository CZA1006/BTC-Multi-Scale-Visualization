from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

from ..services.gdelt_service import get_selected_day_gdelt_context
from ..services.polymarket_service import get_current_polymarket_context

REPO_ROOT = Path(__file__).resolve().parents[3]
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
DERIVED_DIR = REPO_ROOT / "data" / "derived"
BTC_DAILY_PATH = PROCESSED_DIR / "btc_daily.csv"
BTC_INTRADAY_PATH = PROCESSED_DIR / "btc_intraday.csv"
EXTERNAL_ASSETS_PATH = PROCESSED_DIR / "external_assets_daily.csv"
DAILY_FEATURES_PATH = DERIVED_DIR / "daily_features.csv"
EMBEDDING_RESULTS_PATH = DERIVED_DIR / "embedding_results.csv"
WINDOW_RADIUS = 7

router = APIRouter(prefix="/api/day-detail", tags=["day-detail"])


def load_csv_frame(path: Path) -> pd.DataFrame:
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

    return frame


def load_optional_csv_frame(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return load_csv_frame(path)


def safe_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def classify_move(daily_return: float | None) -> str:
    if daily_return is None:
        return "Unclassified BTC move"
    if daily_return >= 0.05:
        return "Strong upside BTC session"
    if daily_return >= 0.02:
        return "Positive BTC session"
    if daily_return <= -0.05:
        return "Sharp BTC drawdown"
    if daily_return <= -0.02:
        return "Negative BTC session"
    return "Range-bound BTC session"


def classify_volatility(
    high_low_range: float | None, rolling_volatility_7d: float | None
) -> str:
    range_value = high_low_range or 0.0
    rolling_value = rolling_volatility_7d or 0.0

    if range_value >= 0.08 or rolling_value >= 0.05:
        return "high-volatility regime"
    if range_value >= 0.04 or rolling_value >= 0.03:
        return "elevated-volatility regime"
    return "contained-volatility regime"


def classify_volume(volume_zscore: float | None) -> str:
    if volume_zscore is None:
        return "normal participation"
    if volume_zscore >= 1.5:
        return "very heavy participation"
    if volume_zscore >= 0.5:
        return "above-normal participation"
    if volume_zscore <= -1.0:
        return "thin participation"
    return "normal participation"


def summarize_external_assets(selected_assets: pd.DataFrame) -> dict[str, Any]:
    if selected_assets.empty:
        return {
            "breadth_label": "No aligned external asset context",
            "positive_count": 0,
            "negative_count": 0,
            "flat_count": 0,
            "leader_ticker": None,
            "leader_return": None,
        }

    asset_frame = selected_assets.copy()
    asset_frame["daily_return"] = pd.to_numeric(asset_frame["daily_return"], errors="coerce")

    positive_count = int((asset_frame["daily_return"] > 0).sum())
    negative_count = int((asset_frame["daily_return"] < 0).sum())
    flat_count = int(
        (asset_frame["daily_return"].abs() <= 1e-12).fillna(False).sum()
    )

    leader_ticker = None
    leader_return = None
    ranked_assets = asset_frame.dropna(subset=["daily_return"])
    if not ranked_assets.empty:
        leader_row = ranked_assets.iloc[
            ranked_assets["daily_return"].abs().argmax()
        ]
        leader_ticker = leader_row["ticker"]
        leader_return = safe_float(leader_row["daily_return"])

    if positive_count > negative_count:
        breadth_label = "External risk assets skewed positive"
    elif negative_count > positive_count:
        breadth_label = "External risk assets skewed negative"
    else:
        breadth_label = "External assets were mixed"

    return {
        "breadth_label": breadth_label,
        "positive_count": positive_count,
        "negative_count": negative_count,
        "flat_count": flat_count,
        "leader_ticker": leader_ticker,
        "leader_return": leader_return,
    }


def build_context_payload(
    target_date: pd.Timestamp,
    selected_row: pd.Series,
    selected_feature_row: pd.Series | None,
    selected_embedding_row: pd.Series | None,
    selected_assets: pd.DataFrame,
    window_start_date: str | None,
    window_end_date: str | None,
) -> dict[str, Any]:
    daily_return = safe_float(selected_feature_row.get("daily_return")) if selected_feature_row is not None else None
    open_close_change = (
        safe_float(selected_feature_row.get("open_close_change"))
        if selected_feature_row is not None
        else None
    )
    high_low_range = (
        safe_float(selected_feature_row.get("high_low_range"))
        if selected_feature_row is not None
        else None
    )
    volume_zscore = (
        safe_float(selected_feature_row.get("volume_zscore"))
        if selected_feature_row is not None
        else None
    )
    rolling_volatility_7d = (
        safe_float(selected_feature_row.get("rolling_volatility_7d"))
        if selected_feature_row is not None
        else None
    )
    rolling_volatility_30d = (
        safe_float(selected_feature_row.get("rolling_volatility_30d"))
        if selected_feature_row is not None
        else None
    )
    drawdown_from_30d_high = (
        safe_float(selected_feature_row.get("drawdown_from_30d_high"))
        if selected_feature_row is not None
        else None
    )

    cluster_id = None
    embedding_x = None
    embedding_y = None
    if selected_embedding_row is not None:
        raw_cluster_id = selected_embedding_row.get("cluster_id")
        cluster_id = int(raw_cluster_id) if raw_cluster_id is not None and not pd.isna(raw_cluster_id) else None
        embedding_x = safe_float(selected_embedding_row.get("x"))
        embedding_y = safe_float(selected_embedding_row.get("y"))

    move_label = classify_move(daily_return)
    volatility_label = classify_volatility(high_low_range, rolling_volatility_7d)
    volume_label = classify_volume(volume_zscore)
    external_summary = summarize_external_assets(selected_assets)

    close_price = safe_float(selected_row.get("close"))
    summary_parts = [move_label, f"in a {volatility_label}"]
    if cluster_id is not None:
        summary_parts.append(f"mapped to meso cluster {cluster_id}")
    narrative_summary = ", ".join(summary_parts) + "."

    narrative_bullets = [
        (
            f"BTC closed at {close_price:,.2f} with a daily return of {daily_return:.2%}."
            if close_price is not None and daily_return is not None
            else "BTC daily move is available, but return classification is incomplete."
        ),
        (
            f"Intraday spread was {high_low_range:.2%}, while 7-day realized volatility sat at {rolling_volatility_7d:.2%}."
            if high_low_range is not None and rolling_volatility_7d is not None
            else f"Price action currently reads as a {volatility_label}."
        ),
        f"Volume conditions suggest {volume_label}.",
        (
            f"{external_summary['breadth_label']}; the largest aligned move came from {external_summary['leader_ticker']} ({external_summary['leader_return']:.2%})."
            if external_summary["leader_ticker"] and external_summary["leader_return"] is not None
            else external_summary["breadth_label"] + "."
        ),
    ]

    return {
        "window_radius_days": WINDOW_RADIUS,
        "window_start": window_start_date,
        "window_end": window_end_date,
        "has_intraday": False,
        "has_external_assets": not selected_assets.empty,
        "event_context_status": "heuristic_local",
        "narrative_summary": narrative_summary,
        "narrative_bullets": narrative_bullets,
        "market_state": {
            "cluster_id": cluster_id,
            "move_label": move_label,
            "volatility_label": volatility_label,
            "volume_label": volume_label,
            "daily_return": daily_return,
            "open_close_change": open_close_change,
            "high_low_range": high_low_range,
            "rolling_volatility_7d": rolling_volatility_7d,
            "rolling_volatility_30d": rolling_volatility_30d,
            "drawdown_from_30d_high": drawdown_from_30d_high,
        },
        "external_signal_summary": external_summary,
        "backtracking": {
            "macro": {
                "selected_date": target_date.strftime("%Y-%m-%d"),
                "month_bucket": target_date.strftime("%Y-%m"),
                "window_start": window_start_date,
                "window_end": window_end_date,
            },
            "meso": {
                "cluster_id": cluster_id,
                "cluster_label": f"Cluster {cluster_id}" if cluster_id is not None else "No cluster match",
                "embedding_x": embedding_x,
                "embedding_y": embedding_y,
            },
        },
    }


@router.get("")
def get_day_detail(date: str) -> dict[str, Any]:
    btc_daily = load_csv_frame(BTC_DAILY_PATH).sort_values("date").reset_index(drop=True)
    btc_intraday = load_optional_csv_frame(BTC_INTRADAY_PATH)
    daily_features = load_optional_csv_frame(DAILY_FEATURES_PATH)
    embedding_results = load_optional_csv_frame(EMBEDDING_RESULTS_PATH)
    external_assets = (
        load_csv_frame(EXTERNAL_ASSETS_PATH).sort_values(["date", "ticker"]).reset_index(drop=True)
    )

    target_date = pd.to_datetime(date, errors="coerce")
    if pd.isna(target_date):
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    matching_rows = btc_daily.loc[btc_daily["date"] == target_date]
    if matching_rows.empty:
        raise HTTPException(status_code=404, detail=f"No BTC daily record found for {date}")

    target_index = matching_rows.index[0]
    window_start = max(0, target_index - WINDOW_RADIUS)
    window_end = min(len(btc_daily), target_index + WINDOW_RADIUS + 1)

    btc_window = btc_daily.iloc[window_start:window_end].copy()
    btc_window["date"] = btc_window["date"].dt.strftime("%Y-%m-%d")

    selected_row = matching_rows.iloc[0].copy()
    previous_close = (
        float(btc_daily.iloc[target_index - 1]["close"]) if target_index > 0 else None
    )
    daily_return = (
        (float(selected_row["close"]) - previous_close) / previous_close
        if previous_close not in (None, 0)
        else None
    )
    open_close_change = (
        (float(selected_row["close"]) - float(selected_row["open"])) / float(selected_row["open"])
        if float(selected_row["open"]) != 0
        else None
    )

    selected_assets = external_assets.loc[external_assets["date"] == target_date].copy()
    selected_assets["date"] = selected_assets["date"].dt.strftime("%Y-%m-%d")

    selected_feature_row = None
    if not daily_features.empty:
        feature_rows = daily_features.loc[daily_features["date"] == target_date]
        if not feature_rows.empty:
            selected_feature_row = feature_rows.iloc[0]

    selected_embedding_row = None
    if not embedding_results.empty:
        embedding_rows = embedding_results.loc[embedding_results["date"] == target_date]
        if not embedding_rows.empty:
            selected_embedding_row = embedding_rows.iloc[0]

    intraday_rows: list[dict[str, Any]] = []
    if not btc_intraday.empty:
        if "timestamp" in btc_intraday.columns:
            btc_intraday["timestamp"] = pd.to_datetime(
                btc_intraday["timestamp"], errors="coerce"
            )
            btc_intraday = btc_intraday.dropna(subset=["timestamp"]).copy()
        if "trade_date" in btc_intraday.columns:
            intraday_for_day = btc_intraday.loc[btc_intraday["trade_date"] == date].copy()
            if "timestamp" in intraday_for_day.columns:
                intraday_for_day["timestamp"] = intraday_for_day["timestamp"].dt.strftime(
                    "%Y-%m-%dT%H:%M:%S"
                )
            intraday_rows = intraday_for_day.where(pd.notna(intraday_for_day), None).to_dict(
                orient="records"
            )

    gdelt_context = get_selected_day_gdelt_context(date)
    event_rows = gdelt_context.get("articles", [])
    polymarket_context = get_current_polymarket_context()

    context_payload = build_context_payload(
        target_date=target_date,
        selected_row=selected_row,
        selected_feature_row=selected_feature_row,
        selected_embedding_row=selected_embedding_row,
        selected_assets=selected_assets,
        window_start_date=btc_window.iloc[0]["date"] if not btc_window.empty else None,
        window_end_date=btc_window.iloc[-1]["date"] if not btc_window.empty else None,
    )
    context_payload["has_intraday"] = len(intraday_rows) > 0
    context_payload["event_context_status"] = gdelt_context.get("status", "placeholder")
    context_payload["event_context_message"] = gdelt_context.get("message")
    context_payload["gdelt_news_count"] = gdelt_context.get("news_count", 0)
    context_payload["gdelt_top_headlines"] = gdelt_context.get("top_headlines", [])
    context_payload["has_polymarket"] = len(polymarket_context.get("markets", [])) > 0
    context_payload["polymarket_status"] = polymarket_context.get("status", "placeholder")

    return {
        "date": date,
        "btc_detail": {
            "date": date,
            "open": float(selected_row["open"]),
            "high": float(selected_row["high"]),
            "low": float(selected_row["low"]),
            "close": float(selected_row["close"]),
            "volume": float(selected_row["volume"]),
            "daily_return": daily_return,
            "open_close_change": open_close_change,
        },
        "btc_window": btc_window.where(pd.notna(btc_window), None).to_dict(orient="records"),
        "btc_intraday": intraday_rows,
        "external_assets": selected_assets.where(pd.notna(selected_assets), None).to_dict(
            orient="records"
        ),
        "gdelt_selected_day": {
            key: value for key, value in gdelt_context.items() if key != "articles"
        },
        "events_selected_day": event_rows,
        "polymarket_selected_day": polymarket_context,
        "context": context_payload,
    }
