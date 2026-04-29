import React from 'react';
import * as d3 from 'd3';
import { useOverview } from '../hooks/useOverview.js';
import { pctChange, pearson } from '../utils/derived.js';

// 4×4 BTC / COIN / MSTR / QQQ correlation matrix over the selected window.
// Pearson on daily returns, using a fixed [-1, 1] diverging color scale.
// If a regime is selected in Meso View, the matrix is recalculated using only
// the daily-return observations that belong to that selected regime.

const TICKERS = ['BTC', 'COIN', 'MSTR', 'QQQ'];

const COLOR_NEGATIVE = '#d65a5a';
const COLOR_NEUTRAL = '#1a2335';
const COLOR_POSITIVE = '#2ca66a';

function corrColor(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'var(--bg-2)';
  }

  if (value >= 0) {
    return d3.interpolateRgb(COLOR_NEUTRAL, COLOR_POSITIVE)(Math.min(1, value));
  }

  return d3.interpolateRgb(COLOR_NEUTRAL, COLOR_NEGATIVE)(Math.min(1, Math.abs(value)));
}

export function CorrelationMatrix({
  selectedCluster = null,
  clusterDates = [],
  clusterLabel = '',
}) {
  const { overview, isLoading } = useOverview();

  const hasSelectedCluster = selectedCluster !== null && selectedCluster !== undefined;
  const clusterDateSet = new Set(clusterDates);
  const shouldFilterByCluster = hasSelectedCluster && clusterDateSet.size > 0;

  // Build per-ticker date→close maps, then align onto BTC's date axis.
  const byTicker = {};
  byTicker.BTC = new Map(
    overview.btc_daily
      .map((row) => [row.date, Number(row.close)])
      .filter(([, close]) => !Number.isNaN(close)),
  );

  for (const ticker of ['COIN', 'MSTR', 'QQQ']) {
    byTicker[ticker] = new Map(
      overview.external_assets_daily
        .filter((row) => row.ticker === ticker)
        .map((row) => [row.date, Number(row.close)])
        .filter(([, close]) => !Number.isNaN(close)),
    );
  }

  const dates = Array.from(byTicker.BTC.keys()).sort();

  const returnsByTicker = {};
  for (const ticker of TICKERS) {
    const closes = dates.map((date) => {
      const value = byTicker[ticker].get(date);
      return value !== undefined ? value : null;
    });

    // Calculate daily returns on the full selected window first, then filter
    // by regime dates. Filtering dates before pctChange() would create
    // incorrect non-contiguous interval returns.
    const fullWindowReturns = pctChange(closes);

    returnsByTicker[ticker] = shouldFilterByCluster
      ? fullWindowReturns.filter((_, index) => clusterDateSet.has(dates[index]))
      : fullWindowReturns;
  }

  const matrix = TICKERS.map((rowTicker) =>
    TICKERS.map((colTicker) => pearson(returnsByTicker[rowTicker], returnsByTicker[colTicker])),
  );

  const scopeLabel = shouldFilterByCluster
    ? `Filtered by regime: ${clusterLabel || `Cluster ${selectedCluster}`}`
    : 'All regimes in selected window';

  // Shorter card version: compact matrix, readable labels, less vertical empty space.
  const cellSize = 45;
  const padLeft = 48;
  const padTop = 28;
  const width = padLeft + cellSize * TICKERS.length + 10;
  const height = padTop + cellSize * TICKERS.length + 6;

  const legendTicks = [
    { label: '-1', x: '0%' },
    { label: '0', x: '50%' },
    { label: '1', x: '100%' },
  ];

  return (
    <div className="corr-matrix-shell" style={{ width: '100%', boxSizing: 'border-box' }}>
      <div className="corr-matrix-header">
        <span className="corr-matrix-eyebrow">Cross-asset</span>
        <h4 className="corr-matrix-title">Correlation · daily returns</h4>
      </div>

      {isLoading ? (
        <div className="corr-matrix-empty">Loading…</div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label="Asset correlation matrix"
          style={{ display: 'block' }}
        >
          {TICKERS.map((ticker, index) => (
            <text
              key={`col-${ticker}`}
              x={padLeft + index * cellSize + cellSize / 2}
              y={padTop - 8}
              textAnchor="middle"
              className="corr-matrix-axis"
            >
              {ticker}
            </text>
          ))}

          {TICKERS.map((ticker, index) => (
            <text
              key={`row-${ticker}`}
              x={padLeft - 9}
              y={padTop + index * cellSize + cellSize / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="corr-matrix-axis"
            >
              {ticker}
            </text>
          ))}

          {matrix.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              const display = value == null ? '—' : value.toFixed(2);
              const titleValue = value == null ? 'n/a' : value.toFixed(4);

              return (
                <g
                  key={`corr-cell-${rowIndex}-${colIndex}`}
                  transform={`translate(${padLeft + colIndex * cellSize}, ${
                    padTop + rowIndex * cellSize
                  })`}
                >
                  <rect
                    width={cellSize - 3}
                    height={cellSize - 3}
                    rx={2}
                    fill={corrColor(value)}
                    stroke="var(--border)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={(cellSize - 3) / 2}
                    y={(cellSize - 3) / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="corr-matrix-value"
                  >
                    {display}
                  </text>
                  <title>{`${TICKERS[rowIndex]} ↔ ${TICKERS[colIndex]}: ${titleValue}`}</title>
                </g>
              );
            }),
          )}
        </svg>
      )}

      <div className="corr-matrix-caption" style={{ marginTop: 8 }}>
        <div
          style={{
            width: '82%',
            maxWidth: 360,
            margin: '0 auto',
          }}
        >
          <div style={{ marginBottom: 8 }}>{scopeLabel}</div>

          <div
            aria-label="Correlation color scale from negative to positive"
            style={{
              position: 'relative',
              height: 9,
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: `linear-gradient(90deg, ${COLOR_NEGATIVE} 0%, ${COLOR_NEUTRAL} 50%, ${COLOR_POSITIVE} 100%)`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: -3,
                width: 1,
                height: 15,
                background: 'rgba(226, 232, 240, 0.55)',
                transform: 'translateX(-50%)',
              }}
            />
          </div>

          <div
            style={{
              position: 'relative',
              height: 14,
              marginTop: 5,
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
            }}
          >
            {legendTicks.map((tick) => (
              <span
                key={tick.label}
                style={{
                  position: 'absolute',
                  left: tick.x,
                  transform:
                    tick.x === '0%'
                      ? 'translateX(0)'
                      : tick.x === '100%'
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
