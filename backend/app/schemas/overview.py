from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class OverviewMetadata(BaseModel):
    data_source: str
    start_date: date
    end_date: date
    total_points: int = Field(ge=0)
    uses_placeholder: bool


class OverviewSummary(BaseModel):
    latest_close: float
    latest_daily_return: float | None = None
    period_return: float | None = None
    max_drawdown: float | None = None


class TimelinePoint(BaseModel):
    date: date
    close: float
    volume: float | None = None
    daily_return: float | None = None
    drawdown: float | None = None


class CalendarCell(BaseModel):
    date: date
    year: int
    month: int
    week: int
    weekday: int
    close: float
    daily_return: float | None = None


class AssetSnapshot(BaseModel):
    ticker: str
    latest_close: float | None = None
    latest_daily_return: float | None = None
    latest_volume: float | None = None


class OverviewResponse(BaseModel):
    metadata: OverviewMetadata
    summary: OverviewSummary
    series: list[TimelinePoint]
    calendar: list[CalendarCell]
    assets: list[AssetSnapshot]
