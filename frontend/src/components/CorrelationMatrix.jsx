import React from 'react';
import * as d3 from 'd3';
import { useOverview } from '../hooks/useOverview.js';
import { pctChange, pearson } from '../utils/derived.js';

// 4×4 BTC / COIN / MSTR / QQQ correlation matrix over the selected window.
// Pearson on daily returns, ColorBrewer-style green/red diverging on dark.
// Cells are tabular numerics; hover shows full precision.

const TICKERS = ['BTC', 'COIN', 'MSTR', 'QQQ'];

function corrColor(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'var(--bg-2)';
  // Diverging green (pos) ↔ red (neg) on dark base.
  if (v >= 0) {
    return d3.interpolateRgb('#1a2335', '#2ca02c')(Math.min(1, v));
  }
  return d3.interpolateRgb('#1a2335', '#d62728')(Math.min(1, -v));
}

export function CorrelationMatrix() {
  const { overview, isLoading } = useOverview();

  // Build per-ticker date→close maps, then align onto BTC's date axis.
  const byTicker = {};
  byTicker.BTC = new Map(
    overview.btc_daily
      .map((r) => [r.date, Number(r.close)])
      .filter(([, c]) => !Number.isNaN(c)),
  );
  for (const t of ['COIN', 'MSTR', 'QQQ']) {
    byTicker[t] = new Map(
      overview.external_assets_daily
        .filter((r) => r.ticker === t)
        .map((r) => [r.date, Number(r.close)])
        .filter(([, c]) => !Number.isNaN(c)),
    );
  }

  const dates = Array.from(byTicker.BTC.keys()).sort();
  const returnsByTicker = {};
  for (const t of TICKERS) {
    const closes = dates.map((d) => {
      const v = byTicker[t].get(d);
      return v !== undefined ? v : null;
    });
    returnsByTicker[t] = pctChange(closes);
  }

  const matrix = TICKERS.map((row) =>
    TICKERS.map((col) => pearson(returnsByTicker[row], returnsByTicker[col])),
  );

  const cellSize = 44;
  const padLeft = 48;
  const padTop = 24;
  const width = padLeft + cellSize * TICKERS.length + 8;
  const height = padTop + cellSize * TICKERS.length + 8;

  return (
    <div className="corr-matrix-shell">
      <div className="corr-matrix-header">
        <span className="corr-matrix-eyebrow">Cross-asset</span>
        <h4 className="corr-matrix-title">Correlation · daily returns</h4>
      </div>
      {isLoading ? (
        <div className="corr-matrix-empty">Loading…</div>
      ) : (
        <svg width={width} height={height} role="img" aria-label="Asset correlation matrix">
          {TICKERS.map((t, i) => (
            <text
              key={`col-${t}`}
              x={padLeft + i * cellSize + cellSize / 2}
              y={padTop - 8}
              textAnchor="middle"
              className="corr-matrix-axis"
            >
              {t}
            </text>
          ))}
          {TICKERS.map((t, i) => (
            <text
              key={`row-${t}`}
              x={padLeft - 8}
              y={padTop + i * cellSize + cellSize / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="corr-matrix-axis"
            >
              {t}
            </text>
          ))}
          {matrix.map((row, i) =>
            row.map((v, j) => {
              const isDiag = i === j;
              const display = v == null ? '—' : isDiag ? '1.00' : v.toFixed(2);
              const titleVal = v == null ? 'n/a' : v.toFixed(4);
              return (
                <g
                  key={`c-${i}-${j}`}
                  transform={`translate(${padLeft + j * cellSize}, ${padTop + i * cellSize})`}
                >
                  <rect
                    width={cellSize - 2}
                    height={cellSize - 2}
                    fill={isDiag ? 'var(--bg-2)' : corrColor(v)}
                    stroke="var(--border)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={(cellSize - 2) / 2}
                    y={(cellSize - 2) / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="corr-matrix-value"
                  >
                    {display}
                  </text>
                  <title>{`${TICKERS[i]} ↔ ${TICKERS[j]}: ${titleVal}`}</title>
                </g>
              );
            }),
          )}
        </svg>
      )}
      <p className="corr-matrix-caption">
        Pearson(daily returns) · selected window · green = positive, red = negative
      </p>
    </div>
  );
}
