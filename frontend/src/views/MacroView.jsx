import React from 'react';
import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { fetchOverview } from '../api/overview.js';
import { useAppStore } from '../store/useAppStore.js';

const TIME_RANGE_OPTIONS = [
  {
    label: 'Full Range',
    value: {
      start: '2019-01-01',
      end: '2026-04-30',
    },
  },
  {
    label: 'COVID Window',
    value: {
      start: '2020-02-01',
      end: '2020-06-30',
    },
  },
  {
    label: 'Election Window',
    value: {
      start: '2024-09-01',
      end: '2025-01-31',
    },
  },
];

export function MacroView() {
  const selectedTimeRange = useAppStore((state) => state.selectedTimeRange);
  const setSelectedTimeRange = useAppStore((state) => state.setSelectedTimeRange);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);

  const [overview, setOverview] = useState({
    btc_daily: [],
    external_assets_daily: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [brushSelection, setBrushSelection] = useState(null);

  useEffect(() => {
    if (!selectedTimeRange) {
      setSelectedTimeRange(TIME_RANGE_OPTIONS[0].value);
    }
  }, [selectedTimeRange, setSelectedTimeRange]);

  useEffect(() => {
    if (!selectedTimeRange) {
      return undefined;
    }

    let isCancelled = false;

    async function loadOverview() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const payload = await fetchOverview(selectedTimeRange);
        if (isCancelled) {
          return;
        }
        setOverview(payload);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load overview');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      isCancelled = true;
    };
  }, [selectedTimeRange]);

  const parsedBtcRows = overview.btc_daily
    .map((row) => ({
      ...row,
      parsedDate: row.date ? new Date(`${row.date}T00:00:00`) : null,
      openValue: Number(row.open),
      closeValue: Number(row.close),
    }))
    .filter(
      (row) =>
        row.parsedDate instanceof Date &&
        !Number.isNaN(row.openValue) &&
        !Number.isNaN(row.closeValue),
    );

  const timelineRows = parsedBtcRows;
  const heatmapCells = parsedBtcRows.map((row) => ({
    date: row.date,
    monthKey: d3.timeFormat('%Y-%m')(row.parsedDate),
    monthLabel: d3.timeFormat('%b %Y')(row.parsedDate),
    change: row.openValue === 0 ? 0 : (row.closeValue - row.openValue) / row.openValue,
  }));

  const heatmapByMonth = heatmapCells.reduce((accumulator, cell) => {
    if (!accumulator[cell.monthKey]) {
      accumulator[cell.monthKey] = {
        label: cell.monthLabel,
        cells: [],
      };
    }
    accumulator[cell.monthKey].cells.push(cell);
    return accumulator;
  }, {});

  const orderedHeatmapMonths = Object.entries(heatmapByMonth).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const tickerList = [
    ...new Set(overview.external_assets_daily.map((row) => row.ticker).filter(Boolean)),
  ];

  const timeRangeLabel = selectedTimeRange
    ? `${selectedTimeRange.start ?? 'unknown'} to ${selectedTimeRange.end ?? 'unknown'}`
    : 'No time range selected';
  const selectedDateLabel = selectedDate ?? 'No date selected yet';

  const chartWidth = 960;
  const chartHeight = 280;
  const chartMargin = { top: 18, right: 22, bottom: 36, left: 56 };
  const hasTimelineData = timelineRows.length > 1;

  let xScale = null;
  let yScale = null;
  let linePath = '';
  let areaPath = '';
  let xTicks = [];
  let yTicks = [];

  if (hasTimelineData) {
    xScale = d3
      .scaleTime()
      .domain(d3.extent(timelineRows, (row) => row.parsedDate))
      .range([chartMargin.left, chartWidth - chartMargin.right]);

    yScale = d3
      .scaleLinear()
      .domain(d3.extent(timelineRows, (row) => row.closeValue))
      .nice()
      .range([chartHeight - chartMargin.bottom, chartMargin.top]);

    const lineBuilder = d3
      .line()
      .x((row) => xScale(row.parsedDate))
      .y((row) => yScale(row.closeValue))
      .curve(d3.curveMonotoneX);

    const areaBuilder = d3
      .area()
      .x((row) => xScale(row.parsedDate))
      .y0(chartHeight - chartMargin.bottom)
      .y1((row) => yScale(row.closeValue))
      .curve(d3.curveMonotoneX);

    linePath = lineBuilder(timelineRows) ?? '';
    areaPath = areaBuilder(timelineRows) ?? '';
    xTicks = xScale.ticks(5);
    yTicks = yScale.ticks(4);
  }

  function getSvgXCoordinate(event) {
    const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * chartWidth;
    return Math.max(chartMargin.left, Math.min(chartWidth - chartMargin.right, relativeX));
  }

  function commitBrushRange(startPx, endPx) {
    if (!hasTimelineData || !xScale) {
      return;
    }

    const leftPx = Math.max(chartMargin.left, Math.min(startPx, endPx));
    const rightPx = Math.min(chartWidth - chartMargin.right, Math.max(startPx, endPx));
    const brushedWidth = rightPx - leftPx;

    if (brushedWidth < 18) {
      setBrushSelection(null);
      return;
    }

    const startDate = xScale.invert(leftPx);
    const endDate = xScale.invert(rightPx);
    const nextRange = {
      start: d3.timeFormat('%Y-%m-%d')(startDate),
      end: d3.timeFormat('%Y-%m-%d')(endDate),
    };

    setBrushSelection(null);
    setSelectedTimeRange(nextRange);
  }

  function handleBrushStart(event) {
    if (!hasTimelineData || !xScale) {
      return;
    }

    const startPx = getSvgXCoordinate(event);
    setBrushSelection({
      startPx,
      currentPx: startPx,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleBrushMove(event) {
    if (!brushSelection) {
      return;
    }

    const currentPx = getSvgXCoordinate(event);
    setBrushSelection((previous) =>
      previous
        ? {
            ...previous,
            currentPx,
          }
        : null,
    );
  }

  function handleBrushEnd(event) {
    if (!brushSelection) {
      return;
    }

    const endPx = getSvgXCoordinate(event);
    commitBrushRange(brushSelection.startPx, endPx);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  const activeBrushOverlay = brushSelection
    ? {
        left: Math.min(brushSelection.startPx, brushSelection.currentPx),
        right: Math.max(brushSelection.startPx, brushSelection.currentPx),
      }
    : null;

  function heatmapColor(change) {
    if (change >= 0.05) {
      return '#2f9e44';
    }
    if (change >= 0.015) {
      return '#8bcf78';
    }
    if (change <= -0.05) {
      return '#d9485f';
    }
    if (change <= -0.015) {
      return '#f08c9d';
    }
    return '#d9e2f0';
  }

  return (
    <section className="view-card">
      <header className="view-header">
        <p className="view-kicker">View 1</p>
        <h2 className="view-title">Macro Overview</h2>
      </header>

      <div className="control-group">
        <span className="control-label">Selected time range</span>
        <div className="control-row">
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={
                selectedTimeRange?.start === option.value.start &&
                selectedTimeRange?.end === option.value.end
                  ? 'range-button range-button-active'
                  : 'range-button'
              }
              onClick={() => setSelectedTimeRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="state-label">Shared state: {timeRangeLabel}</p>
      </div>

      <section className="placeholder-section">
        <h3 className="placeholder-title">BTC Long-Term Timeline</h3>
        {isLoading ? (
          <div className="placeholder-box">
            <span className="placeholder-label">Loading BTC overview data...</span>
          </div>
        ) : hasTimelineData ? (
          <div className="chart-shell">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="timeline-chart"
              role="img"
              aria-label="BTC long-term timeline"
            >
              <defs>
                <linearGradient id="timelineAreaFill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(64, 123, 255, 0.28)" />
                  <stop offset="100%" stopColor="rgba(64, 123, 255, 0.02)" />
                </linearGradient>
              </defs>

              {yTicks.map((tick) => (
                <g key={`y-${tick}`}>
                  <line
                    x1={chartMargin.left}
                    x2={chartWidth - chartMargin.right}
                    y1={yScale(tick)}
                    y2={yScale(tick)}
                    className="chart-gridline"
                  />
                  <text
                    x={chartMargin.left - 10}
                    y={yScale(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="chart-axis-label"
                  >
                    {Math.round(tick).toLocaleString()}
                  </text>
                </g>
              ))}

              {xTicks.map((tick) => (
                <g key={`x-${tick.toISOString()}`}>
                  <line
                    x1={xScale(tick)}
                    x2={xScale(tick)}
                    y1={chartMargin.top}
                    y2={chartHeight - chartMargin.bottom}
                    className="chart-gridline chart-gridline-vertical"
                  />
                  <text
                    x={xScale(tick)}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="chart-axis-label"
                  >
                    {d3.timeFormat('%Y-%m')(tick)}
                  </text>
                </g>
              ))}

              <path d={areaPath} className="timeline-area" />
              <path d={linePath} className="timeline-line-path" />

              {activeBrushOverlay ? (
                <rect
                  x={activeBrushOverlay.left}
                  y={chartMargin.top}
                  width={Math.max(4, activeBrushOverlay.right - activeBrushOverlay.left)}
                  height={chartHeight - chartMargin.top - chartMargin.bottom}
                  className="timeline-brush-selection"
                />
              ) : null}

              <rect
                x={chartMargin.left}
                y={chartMargin.top}
                width={chartWidth - chartMargin.left - chartMargin.right}
                height={chartHeight - chartMargin.top - chartMargin.bottom}
                className="timeline-brush-overlay"
                onPointerDown={handleBrushStart}
                onPointerMove={handleBrushMove}
                onPointerUp={handleBrushEnd}
              />

              {timelineRows.map((row) => {
                const isSelected = selectedDate === row.date;
                return (
                  <circle
                    key={row.date}
                    cx={xScale(row.parsedDate)}
                    cy={yScale(row.closeValue)}
                    r={isSelected ? 5.8 : 3.2}
                    fill={isSelected ? '#d9485f' : '#407bff'}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? 2 : 1}
                    className="timeline-point"
                    onClick={() => setSelectedDate(row.date)}
                  >
                    <title>{`${row.date} | ${Math.round(row.closeValue).toLocaleString()}`}</title>
                  </circle>
                );
              })}
            </svg>

            <div className="chart-caption-row">
              <p className="chart-caption">
                Rendered points: {timelineRows.length}
              </p>
              <p className="chart-caption">
                Loaded window: {timelineRows[0]?.date} to {timelineRows.at(-1)?.date}
              </p>
              <p className="chart-caption">
                Selected date: {selectedDateLabel}
              </p>
              <p className="chart-caption">
                Drag on the timeline to brush a narrower range
              </p>
            </div>
          </div>
        ) : (
          <div className="placeholder-box">
            <span className="placeholder-label">
              No BTC rows available for the current time range.
            </span>
          </div>
        )}
      </section>

      <section className="placeholder-section">
        <h3 className="placeholder-title">Calendar Heatmap</h3>
        {isLoading ? (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">Loading heatmap data...</span>
          </div>
        ) : orderedHeatmapMonths.length > 0 ? (
          <div className="heatmap-shell">
            <div className="heatmap-month-grid">
              {orderedHeatmapMonths.map(([monthKey, month]) => (
                <section key={monthKey} className="heatmap-month-card">
                  <p className="heatmap-month-label">{month.label}</p>
                  <div className="heatmap-cells">
                    {month.cells.map((cell) => (
                      <button
                        key={cell.date}
                        type="button"
                        className={
                          selectedDate === cell.date
                            ? 'heatmap-cell heatmap-cell-active'
                            : 'heatmap-cell'
                        }
                        style={{ backgroundColor: heatmapColor(cell.change) }}
                        onClick={() => setSelectedDate(cell.date)}
                        title={`${cell.date} | ${`${(cell.change * 100).toFixed(2)}%`}`}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="chart-caption-row">
              <p className="chart-caption">
                Selected date: {selectedDateLabel}
              </p>
              <p className="chart-caption">Click a heatmap cell to update Micro view</p>
            </div>
          </div>
        ) : (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">No heatmap data available.</span>
          </div>
        )}
      </section>

      <div className="summary-box">
        <p className="summary-title">Overview summary</p>
        <p className="state-label">BTC rows loaded: {overview.btc_daily.length}</p>
        <p className="state-label">
          Available external asset tickers: {tickerList.length > 0 ? tickerList.join(', ') : 'None'}
        </p>
        <p className="state-label">Shared state: {selectedDateLabel}</p>
        {errorMessage ? <p className="state-label">Load status: {errorMessage}</p> : null}
      </div>
    </section>
  );
}
