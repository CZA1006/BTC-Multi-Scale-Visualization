import React from 'react';
import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { fetchDayDetail } from '../api/dayDetail.js';
import { useAppStore } from '../store/useAppStore.js';

export function MicroView() {
  const selectedDate = useAppStore((state) => state.selectedDate);
  const selectedCluster = useAppStore((state) => state.selectedCluster);

  const [dayDetail, setDayDetail] = useState({
    btc_detail: null,
    btc_intraday: [],
    btc_window: [],
    external_assets: [],
    context: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!selectedDate) {
      setDayDetail({
        btc_detail: null,
        btc_intraday: [],
        btc_window: [],
        external_assets: [],
        context: null,
      });
      setErrorMessage('');
      setIsLoading(false);
      return undefined;
    }

    let isCancelled = false;

    async function loadDayDetail() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const payload = await fetchDayDetail(selectedDate);
        if (isCancelled) {
          return;
        }
        setDayDetail(payload);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load day detail');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDayDetail();
    return () => {
      isCancelled = true;
    };
  }, [selectedDate]);

  const selectedDateLabel = selectedDate ?? 'No date selected yet';
  const selectedClusterLabel =
    selectedCluster === null || selectedCluster === undefined
      ? 'No cluster selected'
      : `Cluster ${selectedCluster}`;

  const intradayRows = dayDetail.btc_intraday
    .map((row) => ({
      ...row,
      parsedTimestamp: row.timestamp ? new Date(row.timestamp) : null,
      closeValue: Number(row.close),
    }))
    .filter(
      (row) =>
        row.parsedTimestamp instanceof Date &&
        !Number.isNaN(row.closeValue),
    );

  const windowRows = dayDetail.btc_window
    .map((row) => ({
      ...row,
      parsedDate: row.date ? new Date(`${row.date}T00:00:00`) : null,
      closeValue: Number(row.close),
    }))
    .filter(
      (row) =>
        row.parsedDate instanceof Date &&
        !Number.isNaN(row.closeValue),
    );

  const chartMode = intradayRows.length > 1 ? 'intraday' : 'daily_window';
  const chartRows = chartMode === 'intraday' ? intradayRows : windowRows;

  const detailWidth = 920;
  const detailHeight = 280;
  const detailMargin = { top: 18, right: 24, bottom: 36, left: 54 };
  const hasDetailChart = chartRows.length > 1;

  let xScale = null;
  let yScale = null;
  let linePath = '';
  let xTicks = [];
  let yTicks = [];

  if (hasDetailChart) {
    xScale = d3
      .scaleTime()
      .domain(
        d3.extent(
          chartRows,
          (row) => (chartMode === 'intraday' ? row.parsedTimestamp : row.parsedDate),
        ),
      )
      .range([detailMargin.left, detailWidth - detailMargin.right]);

    yScale = d3
      .scaleLinear()
      .domain(d3.extent(chartRows, (row) => row.closeValue))
      .nice()
      .range([detailHeight - detailMargin.bottom, detailMargin.top]);

    linePath =
      d3
        .line()
        .x((row) =>
          xScale(chartMode === 'intraday' ? row.parsedTimestamp : row.parsedDate),
        )
        .y((row) => yScale(row.closeValue))
        .curve(d3.curveMonotoneX)(chartRows) ?? '';

    xTicks = xScale.ticks(5);
    yTicks = yScale.ticks(4);
  }

  function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    return `${(Number(value) * 100).toFixed(2)}%`;
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const context = dayDetail.context ?? {};
  const narrativeBullets = Array.isArray(context.narrative_bullets)
    ? context.narrative_bullets
    : [];
  const marketState = context.market_state ?? {};
  const externalSignalSummary = context.external_signal_summary ?? {};
  const backtracking = context.backtracking ?? {};
  const macroBacktracking = backtracking.macro ?? {};
  const mesoBacktracking = backtracking.meso ?? {};
  const inferredClusterLabel =
    marketState.cluster_id === null || marketState.cluster_id === undefined
      ? selectedClusterLabel
      : `Cluster ${marketState.cluster_id}`;
  const gdeltSummary = dayDetail.gdelt_selected_day ?? {};
  const eventRows = Array.isArray(dayDetail.events_selected_day)
    ? dayDetail.events_selected_day
    : [];
  const polymarketSummary = dayDetail.polymarket_selected_day ?? {};
  const polymarketMarkets = Array.isArray(polymarketSummary.markets)
    ? polymarketSummary.markets
    : [];

  return (
    <section className="view-card">
      <header className="view-header">
        <p className="view-kicker">View 3</p>
        <h2 className="view-title">Micro Detail View</h2>
      </header>

      <div className="summary-box">
        <p className="summary-title">Selected day</p>
        <p className="selected-date-label">{selectedDateLabel}</p>
        <p className="state-label">Shared state: {selectedClusterLabel}</p>
        {!selectedDate ? (
          <p className="state-label">
            Select a date from Macro or Meso to populate the selected-day detail view.
          </p>
        ) : dayDetail.btc_detail ? (
          <>
            <p className="state-label">
              Close: {formatCurrency(dayDetail.btc_detail.close)} | Daily return:{' '}
              {formatPercent(dayDetail.btc_detail.daily_return)}
            </p>
            <p className="state-label">
              Open-close change: {formatPercent(dayDetail.btc_detail.open_close_change)}
            </p>
          </>
        ) : null}
      </div>

      <section className="placeholder-section">
        <h3 className="placeholder-title">Selected-Day Intraday Chart</h3>
        {!selectedDate ? (
          <div className="placeholder-box">
            <span className="placeholder-label">
              Select a date to load the selected-day detail chart.
            </span>
          </div>
        ) : isLoading ? (
          <div className="placeholder-box">
            <span className="placeholder-label">Loading selected-day detail...</span>
          </div>
        ) : hasDetailChart ? (
          <div className="chart-shell">
            <svg
              viewBox={`0 0 ${detailWidth} ${detailHeight}`}
              className="timeline-chart"
              role="img"
              aria-label="Selected-day detail chart"
            >
              {yTicks.map((tick) => (
                <g key={`detail-y-${tick}`}>
                  <line
                    x1={detailMargin.left}
                    x2={detailWidth - detailMargin.right}
                    y1={yScale(tick)}
                    y2={yScale(tick)}
                    className="chart-gridline"
                  />
                  <text
                    x={detailMargin.left - 10}
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
                <g key={`detail-x-${tick.toISOString()}`}>
                  <line
                    x1={xScale(tick)}
                    x2={xScale(tick)}
                    y1={detailMargin.top}
                    y2={detailHeight - detailMargin.bottom}
                    className="chart-gridline chart-gridline-vertical"
                  />
                  <text
                    x={xScale(tick)}
                    y={detailHeight - 10}
                    textAnchor="middle"
                    className="chart-axis-label"
                  >
                    {chartMode === 'intraday'
                      ? d3.timeFormat('%H:%M')(tick)
                      : d3.timeFormat('%m-%d')(tick)}
                  </text>
                </g>
              ))}

              <path d={linePath} className="timeline-line-path" />

              {chartRows.map((row) => (
                <circle
                  key={chartMode === 'intraday' ? row.timestamp : row.date}
                  cx={
                    chartMode === 'intraday'
                      ? xScale(row.parsedTimestamp)
                      : xScale(row.parsedDate)
                  }
                  cy={yScale(row.closeValue)}
                  r={
                    chartMode === 'intraday'
                      ? 3.8
                      : row.date === selectedDate
                        ? 5.5
                        : 3.5
                  }
                  fill={
                    chartMode === 'intraday'
                      ? '#407bff'
                      : row.date === selectedDate
                        ? '#d9485f'
                        : '#407bff'
                  }
                  stroke="#ffffff"
                  strokeWidth="1.2"
                >
                  <title>
                    {chartMode === 'intraday'
                      ? `${row.timestamp} | ${formatCurrency(row.closeValue)}`
                      : `${row.date} | ${formatCurrency(row.closeValue)}`}
                  </title>
                </circle>
              ))}
            </svg>

            <div className="chart-caption-row">
              <p className="chart-caption">
                {chartMode === 'intraday'
                  ? `Intraday points: ${intradayRows.length}`
                  : `Context window: ${dayDetail.context?.window_start} to ${dayDetail.context?.window_end}`}
              </p>
              <p className="chart-caption">
                {chartMode === 'intraday'
                  ? 'Showing selected-day BTC intraday close path'
                  : 'Highlighted point is the selected day'}
              </p>
            </div>
          </div>
        ) : (
          <div className="placeholder-box">
            <span className="placeholder-label">No selected-day window available.</span>
          </div>
        )}
      </section>

      <section className="placeholder-section">
        <h3 className="placeholder-title">Event Context &amp; Backtracking</h3>
        {selectedDate ? (
          <div className="summary-box">
            <p className="summary-title">Selected-day context</p>
            <p className="context-summary">
              {context.narrative_summary ?? 'Selected-day context is loading.'}
            </p>

            <div className="context-chip-row">
              <div className="context-chip">
                <span className="context-chip-label">Meso cluster</span>
                <strong>{inferredClusterLabel}</strong>
              </div>
              <div className="context-chip">
                <span className="context-chip-label">Move state</span>
                <strong>{marketState.move_label ?? 'Unavailable'}</strong>
              </div>
              <div className="context-chip">
                <span className="context-chip-label">Volatility</span>
                <strong>{marketState.volatility_label ?? 'Unavailable'}</strong>
              </div>
              <div className="context-chip">
                <span className="context-chip-label">Volume</span>
                <strong>{marketState.volume_label ?? 'Unavailable'}</strong>
              </div>
            </div>

            {narrativeBullets.length > 0 ? (
              <div className="context-section">
                <p className="summary-title">Narrative explanation</p>
                <ul className="context-list">
                  {narrativeBullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="context-section">
              <p className="summary-title">Backtracking anchors</p>
              <div className="context-backtracking-grid">
                <div className="asset-context-card">
                  <p className="asset-context-ticker">Macro anchor</p>
                  <p className="asset-context-value">{macroBacktracking.month_bucket ?? 'N/A'}</p>
                  <p className="state-label">
                    Window: {macroBacktracking.window_start ?? 'N/A'} to{' '}
                    {macroBacktracking.window_end ?? 'N/A'}
                  </p>
                </div>
                <div className="asset-context-card">
                  <p className="asset-context-ticker">Meso anchor</p>
                  <p className="asset-context-value">{mesoBacktracking.cluster_label ?? 'N/A'}</p>
                  <p className="state-label">
                    Embedding: {mesoBacktracking.embedding_x?.toFixed?.(2) ?? 'N/A'},{' '}
                    {mesoBacktracking.embedding_y?.toFixed?.(2) ?? 'N/A'}
                  </p>
                </div>
                <div className="asset-context-card">
                  <p className="asset-context-ticker">External breadth</p>
                  <p className="asset-context-value">
                    {externalSignalSummary.breadth_label ?? 'Unavailable'}
                  </p>
                  <p className="state-label">
                    Up {externalSignalSummary.positive_count ?? 0} | Down{' '}
                    {externalSignalSummary.negative_count ?? 0} | Flat{' '}
                    {externalSignalSummary.flat_count ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {dayDetail.external_assets.length > 0 ? (
              <div className="context-section">
                <p className="summary-title">External asset context</p>
                <div className="asset-context-grid">
                  {dayDetail.external_assets.map((asset) => (
                    <div key={asset.ticker} className="asset-context-card">
                      <p className="asset-context-ticker">{asset.ticker}</p>
                      <p className="asset-context-value">{formatCurrency(asset.close)}</p>
                      <p className="state-label">
                        Daily return: {formatPercent(asset.daily_return)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="asset-context-grid">
              <div className="asset-context-card">
                <p className="asset-context-ticker">Context source</p>
                <p className="asset-context-value">
                  {context.event_context_status ?? 'placeholder'}
                </p>
                <p className="state-label">
                  {context.event_context_message ??
                    'This round uses local heuristic context from BTC, features, clusters, and aligned external assets.'}
                </p>
              </div>
            </div>

            <div className="context-section">
              <p className="summary-title">Headline panel</p>
              <div className="context-chip-row">
                <div className="context-chip">
                  <span className="context-chip-label">GDELT status</span>
                  <strong>{gdeltSummary.status ?? 'placeholder'}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">News count</span>
                  <strong>{gdeltSummary.news_count ?? 0}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">Regulation mentions</span>
                  <strong>{gdeltSummary.theme_count_regulation ?? 0}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">Election / war mentions</span>
                  <strong>
                    {(gdeltSummary.theme_count_election ?? 0) +
                      (gdeltSummary.theme_count_war ?? 0)}
                  </strong>
                </div>
              </div>

              {eventRows.length > 0 ? (
                <div className="headline-list">
                  {eventRows.map((event, index) => (
                    <article
                      key={`${event.url ?? event.headline}-${index}`}
                      className="headline-card"
                    >
                      <p className="headline-meta">
                        {event.source ?? 'Unknown source'} · {event.category ?? 'general'}
                        {event.timestamp ? ` · ${event.timestamp}` : ''}
                      </p>
                      {event.url ? (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="headline-link"
                        >
                          {event.headline}
                        </a>
                      ) : (
                        <p className="headline-title">{event.headline}</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="placeholder-box placeholder-box-small">
                  <span className="placeholder-label">
                    {gdeltSummary.message ??
                      'No selected-day headlines are available for the current date.'}
                  </span>
                </div>
              )}
            </div>

            <div className="context-section">
              <p className="summary-title">Polymarket context</p>
              <div className="context-chip-row">
                <div className="context-chip">
                  <span className="context-chip-label">Snapshot status</span>
                  <strong>{polymarketSummary.status ?? 'placeholder'}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">Snapshot date</span>
                  <strong>{polymarketSummary.as_of_date ?? 'N/A'}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">Markets loaded</span>
                  <strong>{polymarketMarkets.length}</strong>
                </div>
              </div>

              {polymarketMarkets.length > 0 ? (
                <div className="headline-list">
                  {polymarketMarkets.map((market) => (
                    <article
                      key={market.market_slug ?? market.market_name}
                      className="headline-card"
                    >
                      <p className="headline-meta">
                        {market.theme ?? 'market'} · {market.source_query ?? 'query'}
                      </p>
                      <p className="headline-title">{market.market_name}</p>
                      <p className="state-label">
                        Yes price: {formatPercent(market.yes_price)} | Volume:{' '}
                        {formatCurrency(market.volume)}
                      </p>
                      <p className="state-label">
                        End date: {market.end_date ?? 'N/A'}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="placeholder-box placeholder-box-small">
                  <span className="placeholder-label">
                    {polymarketSummary.message ??
                      'No Polymarket context is available in the current snapshot.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">
              {selectedDate
                ? 'Event / Headlines Panel placeholder'
                : 'Select a date to inspect day context.'}
            </span>
          </div>
        )}
        {errorMessage ? <p className="state-label">Load status: {errorMessage}</p> : null}
      </section>
    </section>
  );
}
