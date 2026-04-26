import React from 'react';
import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { fetchOverview } from '../api/overview.js';
import { useAppStore } from '../store/useAppStore.js';
import { HorizonChart } from '../components/HorizonChart.jsx';
import { PinInsightButton } from '../components/PinInsightButton.jsx';
import { pctChange, rollingMean, rollingStd } from '../utils/derived.js';

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
    label: 'War Window',
    value: {
      start: '2022-02-01',
      end: '2022-05-31',
    },
  },
  {
    label: 'Election Window',
    value: {
      start: '2024-09-01',
      end: '2025-01-31',
    },
  },
  {
    label: 'Iran Window',
    value: {
      start: '2026-03-01',
      end: '2026-04-09',
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
    gdelt_daily_signals: [],
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

  const parsedEventSignals = overview.gdelt_daily_signals
    .map((row) => {
      const newsCount = Number(row.news_count);
      const regulationCount = Number(row.theme_count_regulation);
      const electionCount = Number(row.theme_count_election);
      const warCount = Number(row.theme_count_war);
      const cryptoCount = Number(row.theme_count_crypto);
      const parsedDate = row.date ? new Date(`${row.date}T00:00:00`) : null;
      const score =
        (Number.isNaN(newsCount) ? 0 : newsCount) +
        (Number.isNaN(regulationCount) ? 0 : regulationCount) +
        (Number.isNaN(electionCount) ? 0 : electionCount) +
        (Number.isNaN(warCount) ? 0 : warCount) +
        (Number.isNaN(cryptoCount) ? 0 : cryptoCount);

      let topHeadlines = [];
      if (Array.isArray(row.top_headlines)) {
        topHeadlines = row.top_headlines;
      } else if (typeof row.top_headlines === 'string' && row.top_headlines.trim()) {
        try {
          topHeadlines = JSON.parse(row.top_headlines);
        } catch {
          topHeadlines = [row.top_headlines];
        }
      }

      return {
        ...row,
        parsedDate,
        newsCount: Number.isNaN(newsCount) ? 0 : newsCount,
        score,
        topHeadlines,
      };
    })
    .filter(
      (row) =>
        row.parsedDate instanceof Date &&
        row.status !== 'fetch_error' &&
        row.status !== 'unavailable_historical_range' &&
        row.newsCount > 0,
    );
  const eventSignalByDate = new Map(parsedEventSignals.map((row) => [row.date, row]));
  const timelineRows = parsedBtcRows;
  const heatmapCells = parsedBtcRows.map((row) => ({
    date: row.date,
    monthKey: d3.timeFormat('%Y-%m')(row.parsedDate),
    monthLabel: d3.timeFormat('%b %Y')(row.parsedDate),
    change: row.openValue === 0 ? 0 : (row.closeValue - row.openValue) / row.openValue,
    eventSignal: eventSignalByDate.get(row.date) ?? null,
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
  const highlightedEvents = [...parsedEventSignals]
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const heatmapEventCount = heatmapCells.filter((cell) => cell.eventSignal).length;

  // GDELT coverage in this repo is a recent-window snapshot (see docs/DATA_AND_APIS.md).
  // If the selected window ends more than ~60 days ago, no event markers are expected.
  const gdeltRecentCutoffMs = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const selectedRangeEndMs = selectedTimeRange?.end
    ? new Date(`${selectedTimeRange.end}T00:00:00`).getTime()
    : null;
  const isHistoricalGdeltWindow =
    selectedRangeEndMs !== null && selectedRangeEndMs < gdeltRecentCutoffMs;

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
  let eventSizeScale = null;
  let xTickFormatter = d3.timeFormat('%Y-%m');

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
    const [domainStart, domainEnd] = xScale.domain();
    const spanDays = Math.max(0, d3.timeDay.count(domainStart, domainEnd));
    xTickFormatter = spanDays < 90 ? d3.timeFormat('%b %d') : d3.timeFormat('%Y-%m');
    if (parsedEventSignals.length > 0) {
      eventSizeScale = d3
        .scaleSqrt()
        .domain(d3.extent(parsedEventSignals, (row) => row.newsCount))
        .range([4, 10]);
    }
  }

  // Derived rolling series for horizon graphs.
  const horizonRows = (() => {
    if (!hasTimelineData) return { return7d: [], vol30d: [] };
    const closes = timelineRows.map((r) => r.closeValue);
    const ret = pctChange(closes);
    const ret7d = rollingMean(ret, 7);
    const vol30d = rollingStd(ret, 30);
    return {
      return7d: timelineRows.map((row, i) => ({ parsedDate: row.parsedDate, value: ret7d[i] })),
      vol30d: timelineRows.map((row, i) => ({ parsedDate: row.parsedDate, value: vol30d[i] })),
    };
  })();

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

  // ColorBrewer RdYlGn 7-step, Western convention: green = up, red = down.
  // Symmetric thresholds on absolute daily return.
  function heatmapColor(change) {
    if (change >= 0.05) return '#1a9850';
    if (change >= 0.02) return '#66bd63';
    if (change >= 0.005) return '#a6d96a';
    if (change <= -0.05) return '#a50026';
    if (change <= -0.02) return '#d73027';
    if (change <= -0.005) return '#fdae61';
    return '#f5f5f5';
  }

  // Annotated key events on the Macro timeline (5 anchor points).
  const KEY_EVENTS = [
    { date: '2020-03-12', label: 'COVID crash' },
    { date: '2020-05-11', label: '3rd halving' },
    { date: '2024-01-10', label: 'Spot ETF approval' },
    { date: '2024-04-19', label: '4th halving' },
    { date: '2026-03-26', label: 'Iran tension' },
  ];

  function heatmapEventClass(eventSignal) {
    if (!eventSignal) {
      return 'heatmap-cell-event';
    }
    if (eventSignal.newsCount >= 10) {
      return 'heatmap-cell-event heatmap-cell-event-strong';
    }
    return 'heatmap-cell-event heatmap-cell-event-medium';
  }

  return (
    <section className="view-card">
      <header className="view-header view-header-with-pin">
        <div>
          <p className="view-kicker">View 1</p>
          <h2 className="view-title">Macro Overview</h2>
        </div>
        <PinInsightButton view="macro" />
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

      {hasTimelineData ? (
        <section className="placeholder-section">
          <h3 className="placeholder-title">Rolling Return &amp; Volatility (Horizon)</h3>
          <div className="chart-shell">
            <svg
              viewBox={`0 0 ${chartWidth} 140`}
              className="timeline-chart"
              role="img"
              aria-label="Rolling return and volatility horizon graphs"
            >
              <text x={chartMargin.left} y={12} className="chart-axis-title">
                7-day rolling return
              </text>
              <g transform="translate(0, 16)">
                <HorizonChart
                  rows={horizonRows.return7d}
                  xScale={xScale}
                  width={chartWidth}
                  height={56}
                  margin={{ top: 0, right: 22, bottom: 4, left: chartMargin.left }}
                  bands={4}
                  valueFormatter={(v) => `${(v * 100).toFixed(2)}%`}
                />
              </g>
              <text x={chartMargin.left} y={88} className="chart-axis-title">
                30-day rolling volatility
              </text>
              <g transform="translate(0, 92)">
                <HorizonChart
                  rows={horizonRows.vol30d}
                  xScale={xScale}
                  width={chartWidth}
                  height={48}
                  margin={{ top: 0, right: 22, bottom: 4, left: chartMargin.left }}
                  bands={4}
                  centerOnZero={false}
                  valueFormatter={(v) => `${(v * 100).toFixed(2)}%`}
                />
              </g>
            </svg>
            <div className="chart-caption-row">
              <p className="chart-caption">
                Mirror-folded horizon graph · Western convention (green = up).
              </p>
              <p className="chart-caption">
                Each band ≈ 25% of |max|; darker band = more extreme.
              </p>
            </div>
          </div>
        </section>
      ) : null}

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
                  <stop offset="0%" stopColor="rgba(247, 147, 26, 0.22)" />
                  <stop offset="100%" stopColor="rgba(247, 147, 26, 0.02)" />
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
                    {xTickFormatter(tick)}
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

              {parsedEventSignals.map((eventRow) => {
                const isSelected = selectedDate === eventRow.date;
                const markerX = xScale(eventRow.parsedDate);
                const markerY = chartMargin.top + 12;
                const markerSize = eventSizeScale
                  ? eventSizeScale(eventRow.newsCount)
                  : 6;
                const d = markerSize + (isSelected ? 2 : 0);

                return (
                  <g
                    key={`event-${eventRow.date}`}
                    transform={`translate(${markerX}, ${markerY})`}
                    className={
                      isSelected ? 'event-marker event-marker-active' : 'event-marker'
                    }
                    onClick={() => setSelectedDate(eventRow.date)}
                  >
                    <path
                      d={`M 0,${-d} L ${d},0 L 0,${d} L ${-d},0 Z`}
                      className="event-marker-shape"
                    />
                    <title>
                      {`${eventRow.date} | ${eventRow.newsCount} headlines`}
                    </title>
                  </g>
                );
              })}

              {/* Annotation overlay: leader lines + labels for KEY_EVENTS in domain */}
              {(() => {
                const [domainStart, domainEnd] = xScale.domain();
                const visible = KEY_EVENTS
                  .map((evt) => ({ ...evt, parsedDate: new Date(`${evt.date}T00:00:00`) }))
                  .filter((evt) => evt.parsedDate >= domainStart && evt.parsedDate <= domainEnd);
                return (
                  <g className="annotations" pointerEvents="none">
                    {visible.map((evt, i) => {
                      const ax = xScale(evt.parsedDate);
                      const labelY = chartMargin.top + 4 + (i % 2) * 12;
                      const anchorY = chartMargin.top + 26;
                      return (
                        <g key={`annot-${evt.date}`}>
                          <line
                            x1={ax}
                            x2={ax}
                            y1={labelY + 4}
                            y2={anchorY}
                            className="event-annotation-leader"
                          />
                          <text
                            x={ax}
                            y={labelY}
                            textAnchor="middle"
                            className="event-annotation-label"
                          >
                            {evt.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

              {timelineRows.map((row) => {
                const isSelected = selectedDate === row.date;
                const isDense = timelineRows.length > 120;
                if (isDense && !isSelected) return null;
                return (
                  <circle
                    key={row.date}
                    cx={xScale(row.parsedDate)}
                    cy={yScale(row.closeValue)}
                    r={isSelected ? 5.8 : 2.6}
                    fill={isSelected ? 'var(--accent-btc)' : 'var(--accent-btc)'}
                    stroke={isSelected ? '#ffffff' : 'rgba(11,15,23,0.7)'}
                    strokeWidth={isSelected ? 2 : 0.8}
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
                Event markers: {parsedEventSignals.length}
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
            <div className="heatmap-legend">
              <span className="heatmap-legend-title">Daily return</span>
              <span className="heatmap-legend-item">
                −5%
                <span className="heatmap-legend-ramp" aria-hidden="true">
                  <span style={{ background: '#a50026' }} />
                  <span style={{ background: '#d73027' }} />
                  <span style={{ background: '#fdae61' }} />
                  <span style={{ background: '#f5f5f5' }} />
                  <span style={{ background: '#a6d96a' }} />
                  <span style={{ background: '#66bd63' }} />
                  <span style={{ background: '#1a9850' }} />
                </span>
                +5%
              </span>
              <span className="heatmap-legend-title" style={{ marginLeft: 12 }}>
                Event intensity
              </span>
              <span className="heatmap-legend-item">
                <span className="heatmap-cell-event" style={{ position: 'static' }} />
                1–9 headlines
              </span>
              <span className="heatmap-legend-item">
                <span
                  className="heatmap-cell-event heatmap-cell-event-strong"
                  style={{ position: 'static' }}
                />
                10+ headlines
              </span>
            </div>
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
                        title={`${cell.date} | ${`${(cell.change * 100).toFixed(2)}%`}${
                          cell.eventSignal
                            ? ` | ${cell.eventSignal.newsCount} headlines`
                            : ''
                        }`}
                      >
                        {cell.eventSignal ? (
                          <span
                            className={heatmapEventClass(cell.eventSignal)}
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="chart-caption-row">
              <p className="chart-caption">
                Selected date: {selectedDateLabel}
              </p>
              <p className="chart-caption">Event days in heatmap: {heatmapEventCount}</p>
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
        <p className="state-label">Event overlay rows: {overview.gdelt_daily_signals.length}</p>
        {errorMessage ? <p className="state-label error-label">Load status: {errorMessage}</p> : null}
      </div>

      <div className="summary-box">
        <p className="summary-title">Event overlay summary</p>
        {highlightedEvents.length > 0 ? (
          <div className="event-summary-list">
            {highlightedEvents.map((eventRow) => (
              <button
                key={`summary-${eventRow.date}`}
                type="button"
                className={
                  selectedDate === eventRow.date
                    ? 'event-summary-card event-summary-card-active'
                    : 'event-summary-card'
                }
                onClick={() => setSelectedDate(eventRow.date)}
              >
                <span className="event-summary-date">{eventRow.date}</span>
                <span className="event-summary-value">{eventRow.newsCount} headlines</span>
                <span className="event-summary-text">
                  {(eventRow.topHeadlines?.[0] ?? '').slice(0, 88) || 'No top headline available'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="state-label">
            {isHistoricalGdeltWindow
              ? 'GDELT coverage in this snapshot is limited to the recent window, so historical event overlays are not shown here. Switch to the Iran Tension window to see live headlines.'
              : 'No event-overlay rows are available for the current window yet.'}
          </p>
        )}
      </div>
    </section>
  );
}
