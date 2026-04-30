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

const FULL_RANGE = TIME_RANGE_OPTIONS[0].value;

export function MacroView() {
  const selectedTimeRange = useAppStore((state) => state.selectedTimeRange);
  const setSelectedTimeRange = useAppStore((state) => state.setSelectedTimeRange);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);

  const [overview, setOverview] = useState({
    btc_daily: [],
    external_assets_daily: [],
    gdelt_daily_signals: [],
    daily_features: [],
  });
  const [isLoading, setIsLoading] = useState(true);
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
        setOverview({
          btc_daily: [],
          external_assets_daily: [],
          gdelt_daily_signals: [],
        });
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
  const heatmapEventCount = heatmapCells.filter((cell) => cell.eventSignal).length;
  const isFullRangeSelected =
    selectedTimeRange?.start === FULL_RANGE.start &&
    selectedTimeRange?.end === FULL_RANGE.end;
  const shouldShowHeatmap = !isFullRangeSelected;

  const timeRangeLabel = selectedTimeRange
    ? `${selectedTimeRange.start ?? 'unknown'} to ${selectedTimeRange.end ?? 'unknown'}`
    : 'No time range selected';
  const selectedDateLabel = selectedDate ?? 'No date selected yet';

  const chartWidth = 960;
  const chartHeight = 260;
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

  const shortTermPanels = (() => {
    if (!hasTimelineData) return { return7d: [], vol30dAnnualized: [] };
    
    // Create a map of date -> daily_features for quick lookup
    const featuresByDate = new Map(
      overview.daily_features.map((row) => [row.date, row])
    );

    return {
      return7d: timelineRows.map((row) => {
        const feature = featuresByDate.get(row.date);
        const value = feature?.rolling_return_7d
          ? Number(feature.rolling_return_7d)
          : null;
        return {
          date: row.date,
          parsedDate: row.parsedDate,
          value: Number.isFinite(value) ? value : null,
        };
      }),
      vol30dAnnualized: timelineRows.map((row) => {
        const feature = featuresByDate.get(row.date);
        let value = feature?.rolling_volatility_30d
          ? Number(feature.rolling_volatility_30d)
          : null;
        // Annualize the volatility
        if (Number.isFinite(value) && value !== null) {
          value = value * Math.sqrt(365);
        }
        return {
          date: row.date,
          parsedDate: row.parsedDate,
          value: Number.isFinite(value) ? value : null,
        };
      }),
    };
  })();

  const returnRows = shortTermPanels.return7d.filter((row) => Number.isFinite(row.value));
  const volatilityRows = shortTermPanels.vol30dAnnualized.filter((row) => Number.isFinite(row.value));
  
  // Calculate P95 from FULL history (overview.daily_features is never filtered by time range).
  // This keeps the Y-axis completely stable when brushing different ranges.
  const allReturnValuesFromFeatures = overview.daily_features
    .map((row) => {
      const val = Number(row.rolling_return_7d);
      return Number.isFinite(val) ? Math.abs(val) : null;
    })
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  const returnAbsP95 =
    allReturnValuesFromFeatures.length > 0 ? d3.quantileSorted(allReturnValuesFromFeatures, 0.95) ?? 0 : 0;

  const shortTermHeight = 250;
  const shortTermLeft = chartMargin.left;
  const shortTermRight = 26;
  const returnPanelTop = 36;
  const returnPanelHeight = 74;
  const volatilityPanelTop = 146;
  const volatilityPanelHeight = 72;

  const shortTermXScale = hasTimelineData
    ? xScale.copy().range([shortTermLeft, chartWidth - shortTermRight])
    : null;

  const returnLimit = Math.max(0.04, Math.min(0.16, returnAbsP95 * 1.35));
  const returnTickValues = [-returnLimit, -returnLimit / 2, 0, returnLimit / 2, returnLimit];

  function formatSignedPercent(value) {
    const pct = value * 100;
    const useOneDecimal = Math.abs(pct) < 10;
    const text = `${useOneDecimal ? pct.toFixed(1) : Math.round(pct)}%`;
    return pct > 0 ? `+${text}` : text;
  }

  const returnYScale = d3
    .scaleLinear()
    .domain([returnLimit, -returnLimit])
    .range([returnPanelTop, returnPanelTop + returnPanelHeight]);

  const volatilityMax = Math.max(
    1,
    (d3.max(volatilityRows, (row) => row.value) ?? 0.6) * 1.08,
  );
  const volatilityTickMax = Math.max(1, Math.ceil(volatilityMax / 0.2) * 0.2);
  const volatilityTickValues = d3.range(0.2, volatilityTickMax + 0.001, 0.2);
  const volatilityYScale = d3
    .scaleLinear()
    .domain([0, volatilityTickMax])
    .range([volatilityPanelTop + volatilityPanelHeight, volatilityPanelTop]);

  const volatilityAreaPath =
    shortTermXScale && volatilityRows.length > 1
      ? d3
          .area()
          .x((row) => shortTermXScale(row.parsedDate))
          .y0(volatilityPanelTop + volatilityPanelHeight)
          .y1((row) => volatilityYScale(row.value))(volatilityRows) ?? ''
      : '';

  const returnBarWidth = Math.max(
    1,
    Math.min(
      8,
      ((chartWidth - shortTermLeft - shortTermRight) / Math.max(returnRows.length, 1)) * 0.85,
    ),
  );
  const volatilityBarWidth = Math.max(
    1,
    Math.min(
      10,
      ((chartWidth - shortTermLeft - shortTermRight) / Math.max(volatilityRows.length, 1)) * 0.9,
    ),
  );

  function returnBandColor(value) {
    const lowerExtreme = -returnLimit;
    const lowerMid = -returnLimit / 2;
    const upperMid = returnLimit / 2;
    const upperExtreme = returnLimit;
    if (value <= lowerExtreme) return '#d70040';
    if (value <= lowerMid) return '#f39c3d';
    if (value < upperMid) return '#fff3a3';
    if (value < upperExtreme) return '#97d35f';
    return '#1fbf76';
  }

  function volatilityBandColor(value) {
    if (value < 0.4) return '#8eb8df';
    if (value < 0.6) return '#5f9fd8';
    if (value < 0.8) return '#357fcb';
    return '#1f5fb5';
  }

  const returnLegendBins = (() => {
    const lowerExtreme = -returnLimit;
    const lowerMid = -returnLimit / 2;
    const upperMid = returnLimit / 2;
    const upperExtreme = returnLimit;
    return [
      {
        label: `≤ ${formatSignedPercent(lowerExtreme)}`,
        color: '#d70040',
        matches: (value) => value <= lowerExtreme,
      },
      {
        label: `${formatSignedPercent(lowerExtreme)} to ${formatSignedPercent(lowerMid)}`,
        color: '#f39c3d',
        matches: (value) => value > lowerExtreme && value <= lowerMid,
      },
      {
        label: `${formatSignedPercent(lowerMid)} to ${formatSignedPercent(upperMid)}`,
        color: '#fff3a3',
        matches: (value) => value > lowerMid && value < upperMid,
      },
      {
        label: `${formatSignedPercent(upperMid)} to ${formatSignedPercent(upperExtreme)}`,
        color: '#97d35f',
        matches: (value) => value >= upperMid && value < upperExtreme,
      },
      {
        label: `≥ ${formatSignedPercent(upperExtreme)}`,
        color: '#1fbf76',
        matches: (value) => value >= upperExtreme,
      },
    ];
  })();
  const returnLegendItems = returnLegendBins
    .filter((bin) => returnRows.some((row) => Number.isFinite(row.value) && bin.matches(row.value)))
    .map((bin) => ({ label: bin.label, color: bin.color }));

  const volatilityLegendItems = [
    { label: '< 40%', color: '#8eb8df' },
    { label: '40-60%', color: '#5f9fd8' },
    { label: '60-80%', color: '#357fcb' },
    { label: '> 80%', color: '#1f5fb5' },
  ];

  function estimateLegendItemWidth(label) {
    return label.length * 6.2 + 26;
  }

  function buildInlineLegendLayout(items, rightEdge) {
    let cursor = rightEdge;
    return [...items]
      .reverse()
      .map((item) => {
        const width = estimateLegendItemWidth(item.label);
        cursor -= width;
        const placed = { ...item, x: cursor };
        cursor -= 10;
        return placed;
      })
      .reverse();
  }

  const rightLegendEdge = chartWidth - shortTermRight - 4;
  const returnLegendLayout = buildInlineLegendLayout(returnLegendItems, rightLegendEdge);
  const volatilityLegendLayout = buildInlineLegendLayout(volatilityLegendItems, rightLegendEdge);
  const selectedShortTermRow = selectedDate
    ? timelineRows.find((row) => row.date === selectedDate)
    : null;
  const selectedShortTermX =
    selectedShortTermRow && shortTermXScale
      ? shortTermXScale(selectedShortTermRow.parsedDate)
      : null;

  function setRangeStart(nextStart) {
    const start = nextStart || FULL_RANGE.start;
    const end = selectedTimeRange?.end ?? FULL_RANGE.end;
    setSelectedTimeRange({
      start,
      end: end < start ? start : end,
    });
  }

  function setRangeEnd(nextEnd) {
    const start = selectedTimeRange?.start ?? FULL_RANGE.start;
    const end = nextEnd || FULL_RANGE.end;
    setSelectedTimeRange({
      start: start > end ? end : start,
      end,
    });
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

  // ColorBrewer RdYlGn 7-step, Western convention: green = up, red = down.
  // Symmetric thresholds on absolute daily return.
  function heatmapColor(change) {
    if (change >= 0.05) return '#1a9850';
    if (change >= 0.02) return '#66bd63';
    if (change >= 0.005) return '#a6d96a';
    if (change <= -0.05) return '#a50026';
    if (change <= -0.02) return '#d73027';
    if (change <= -0.005) return '#fdae61';
    return '#fff3a3';
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

  const shortTermSection = hasTimelineData ? (
    <section className="placeholder-section">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <h3 className="placeholder-title" style={{ margin: 0 }}>
          Short-Term Return &amp; Volatility
        </h3>
        <span className="chart-range-pill">{timeRangeLabel}</span>
      </div>
      <div className="chart-shell short-term-shell">
        <p className="short-term-subtitle">
          7D rolling return and 30D annualized volatility in the selected window
        </p>
        <svg
          viewBox={`0 0 ${chartWidth} ${shortTermHeight}`}
          className="timeline-chart"
          role="img"
          aria-label="Short-term return and volatility chart"
        >
          {returnTickValues.map((tick) => (
            <g key={`short-return-grid-${tick}`}>
              <line
                x1={shortTermLeft}
                x2={chartWidth - shortTermRight}
                y1={returnYScale(tick)}
                y2={returnYScale(tick)}
                className="chart-gridline"
              />
              <text
                x={shortTermLeft - 10}
                y={returnYScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="chart-axis-label"
              >
                {tick === 0 ? '0' : formatSignedPercent(tick)}
              </text>
            </g>
          ))}

          <text x={shortTermLeft} y={returnPanelTop - 10} className="short-term-panel-title">
            7D Rolling Return (%)
          </text>

          {returnLegendLayout.map((item) => (
            <g
              key={`short-return-legend-${item.label}`}
              transform={`translate(${item.x}, ${returnPanelTop - 10})`}
              className="short-term-inline-legend"
            >
              <rect
                x={0}
                y={-9}
                width={10}
                height={10}
                rx={2}
                fill={item.color}
                stroke="rgba(255,255,255,0.25)"
              />
              <text x={16} y={0} className="short-term-inline-legend-label">
                {item.label}
              </text>
            </g>
          ))}

          {returnRows.map((row) => {
            const clamped = Math.max(-returnLimit, Math.min(returnLimit, row.value));
            const zeroY = returnYScale(0);
            const valueY = returnYScale(clamped);
            const isSelectedDay = selectedDate && row.date === selectedDate;
            return (
              <rect
                key={`return-bar-${row.parsedDate.toISOString()}`}
                x={shortTermXScale(row.parsedDate) - returnBarWidth / 2}
                y={Math.min(zeroY, valueY)}
                width={returnBarWidth}
                height={Math.max(1, Math.abs(zeroY - valueY))}
                fill={returnBandColor(clamped)}
                opacity={isSelectedDay ? 1 : 0.9}
                stroke={isSelectedDay ? 'var(--accent-highlight)' : 'none'}
                strokeWidth={isSelectedDay ? 1.2 : 0}
              />
            );
          })}

          <line
            x1={shortTermLeft}
            x2={chartWidth - shortTermRight}
            y1={returnYScale(0)}
            y2={returnYScale(0)}
            className="short-term-zero-line"
          />

          {volatilityTickValues.map((tick) => (
            <g key={`short-vol-grid-${tick}`}>
              <line
                x1={shortTermLeft}
                x2={chartWidth - shortTermRight}
                y1={volatilityYScale(tick)}
                y2={volatilityYScale(tick)}
                className="chart-gridline"
              />
              <text
                x={shortTermLeft - 10}
                y={volatilityYScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="chart-axis-label"
              >
                {`${Math.round(tick * 100)}%`}
              </text>
            </g>
          ))}

          <text
            x={shortTermLeft}
            y={volatilityPanelTop - 10}
            className="short-term-panel-title"
          >
            30D Annualized Volatility (%)
          </text>

          {volatilityLegendLayout.map((item) => (
            <g
              key={`short-vol-legend-${item.label}`}
              transform={`translate(${item.x}, ${volatilityPanelTop - 10})`}
              className="short-term-inline-legend"
            >
              <rect
                x={0}
                y={-9}
                width={10}
                height={10}
                rx={2}
                fill={item.color}
                stroke="rgba(255,255,255,0.25)"
              />
              <text x={16} y={0} className="short-term-inline-legend-label">
                {item.label}
              </text>
            </g>
          ))}

          {volatilityRows.map((row) => (
            <rect
              key={`vol-bar-${row.parsedDate.toISOString()}`}
              x={shortTermXScale(row.parsedDate) - volatilityBarWidth / 2}
              y={volatilityYScale(row.value)}
              width={volatilityBarWidth}
              height={volatilityPanelTop + volatilityPanelHeight - volatilityYScale(row.value)}
              fill={volatilityBandColor(row.value)}
              opacity={selectedDate && row.date === selectedDate ? 1 : 0.82}
              stroke={selectedDate && row.date === selectedDate ? 'var(--accent-highlight)' : 'none'}
              strokeWidth={selectedDate && row.date === selectedDate ? 1.2 : 0}
            />
          ))}

          {selectedShortTermX !== null ? (
            <line
              x1={selectedShortTermX}
              x2={selectedShortTermX}
              y1={returnPanelTop - 2}
              y2={volatilityPanelTop + volatilityPanelHeight}
              stroke="var(--accent-highlight)"
              strokeWidth={1.2}
              strokeDasharray="4 3"
              opacity={0.9}
            />
          ) : null}

          {volatilityAreaPath ? (
            <path d={volatilityAreaPath} className="short-term-volatility-line" />
          ) : null}

          {xTicks.map((tick) => (
            <text
              key={`short-term-tick-${tick.toISOString()}`}
              x={shortTermXScale(tick)}
              y={shortTermHeight - 10}
              textAnchor="middle"
              className="chart-axis-label"
            >
              {xTickFormatter(tick)}
            </text>
          ))}
        </svg>
      </div>
    </section>
  ) : null;

  return (
    <section className="view-card">
      <header className="view-header">
        <div className="macro-header-row">
          <div>
            <p className="view-kicker">View 1</p>
            <h2 className="view-title">Marco Overview: Identify Market-Wide Trend &amp; Volatility</h2>
          </div>
          <div className="macro-range-controls" aria-label="Macro time range controls">
            <button
              type="button"
              className="range-button"
              onClick={() => setSelectedTimeRange(FULL_RANGE)}
            >
              Full Range
            </button>
            <div className="macro-range-inputs">
              <input
                type="date"
                className="macro-date-input"
                value={selectedTimeRange?.start ?? FULL_RANGE.start}
                min={FULL_RANGE.start}
                max={FULL_RANGE.end}
                onChange={(event) => setRangeStart(event.target.value)}
                aria-label="Start date"
              />
              <span className="macro-range-separator">to</span>
              <input
                type="date"
                className="macro-date-input"
                value={selectedTimeRange?.end ?? FULL_RANGE.end}
                min={FULL_RANGE.start}
                max={FULL_RANGE.end}
                onChange={(event) => setRangeEnd(event.target.value)}
                aria-label="End date"
              />
            </div>
          </div>
        </div>
      </header>

      <section className="placeholder-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h3 className="placeholder-title" style={{ margin: 0 }}>
            BTC Price Trend in Selected Window
          </h3>
        </div>
        {isLoading ? (
          <div className="placeholder-box">
            <span className="placeholder-label">Loading BTC overview data...</span>
          </div>
        ) : hasTimelineData ? (
          <div className="chart-shell">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="xMidYMid meet"
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

              {/* Event markers removed: headlines not shown in timeline */}

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
              <p className="chart-caption">Drag on the timeline to brush a narrower range</p>
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

      {shortTermSection}

      <section className="placeholder-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h3 className="placeholder-title" style={{ margin: 0 }}>Calendar Heatmap</h3>
          <span className="chart-range-pill">{selectedDateLabel}</span>
        </div>
        {isLoading ? (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">Loading heatmap data...</span>
          </div>
        ) : shouldShowHeatmap && orderedHeatmapMonths.length > 0 ? (
          <div className="heatmap-shell">
            <div className="heatmap-legend">
              <span className="heatmap-legend-title">Daily return</span>
              <span className="heatmap-legend-item">
                ≤ −5%
                <span className="heatmap-legend-ramp" aria-hidden="true">
                  <span style={{ background: '#a50026' }} />
                  <span style={{ background: '#d73027' }} />
                  <span style={{ background: '#fdae61' }} />
                  <span style={{ background: '#fff3a3' }} />
                  <span style={{ background: '#a6d96a' }} />
                  <span style={{ background: '#66bd63' }} />
                  <span style={{ background: '#1a9850' }} />
                </span>
                ≥ +5%
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
                        title={`${cell.date} | ${(cell.change * 100).toFixed(2)}%`}
                      >
                        {/* Event badge removed: headlines not shown in heatmap */}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="chart-caption-row">
              <p className="chart-caption">Click a heatmap cell to update Micro view</p>
            </div>
          </div>
        ) : !shouldShowHeatmap ? (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">Please select a time range to show the heatmap.</span>
          </div>
        ) : (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">No heatmap data available.</span>
          </div>
        )}
      </section>

    </section>
  );
}
