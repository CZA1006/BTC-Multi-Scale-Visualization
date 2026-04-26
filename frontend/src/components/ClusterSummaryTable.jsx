import React from 'react';
import * as d3 from 'd3';
import { cumulativeReturnIndex } from '../utils/derived.js';

// Bloomberg-style small-multiples table: one row per cluster.
// Columns: swatch · regime · n · mean return · mean vol · mean drawdown · equity-curve sparkline.
// Equity curve = cumulative product of (1 + daily_return) over rows in that cluster,
// sorted by date — pure shape, no absolute price needed.

function MiniSpark({ values, color, width = 96, height = 22 }) {
  const series = (values ?? []).filter(
    (v) => v !== null && v !== undefined && !Number.isNaN(v),
  );
  if (series.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const x = d3
    .scaleLinear()
    .domain([0, series.length - 1])
    .range([1, width - 1]);
  const [lo, hi] = d3.extent(series);
  const pad = (hi - lo) * 0.08 || 1e-6;
  const y = d3
    .scaleLinear()
    .domain([lo - pad, hi + pad])
    .range([height - 2, 2]);
  const line = d3
    .line()
    .x((_, i) => x(i))
    .y((v) => y(v))
    .curve(d3.curveMonotoneX);
  // Reference baseline at y=1 (cumulative-return base).
  const baseY = y(1);
  const baseInRange = baseY >= 0 && baseY <= height;
  return (
    <svg width={width} height={height} className="cluster-spark" aria-hidden="true">
      {baseInRange ? (
        <line
          x1={1}
          x2={width - 1}
          y1={baseY}
          y2={baseY}
          stroke="var(--border)"
          strokeDasharray="2 2"
          strokeWidth="0.6"
        />
      ) : null}
      <path d={line(series) ?? ''} stroke={color} fill="none" strokeWidth="1.3" />
    </svg>
  );
}

function fmtPct(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function ClusterSummaryTable({
  clusterProfiles,
  parsedFeatureRows,
  clusterColorScale,
  semanticLabelForCluster,
  selectedCluster,
  setSelectedCluster,
}) {
  if (!clusterProfiles || clusterProfiles.length === 0) {
    return null;
  }

  // Sort clusters by mean daily return descending — most positive regime on top.
  const ordered = [...clusterProfiles].sort(
    (a, b) => (b.values?.daily_return ?? 0) - (a.values?.daily_return ?? 0),
  );

  return (
    <div className="cluster-summary-table" role="table" aria-label="Cluster summary">
      <div className="cluster-summary-row cluster-summary-header" role="row">
        <span aria-hidden="true" />
        <span>Regime</span>
        <span className="cluster-summary-num">n</span>
        <span className="cluster-summary-num">Mean Ret</span>
        <span className="cluster-summary-num">Mean Vol</span>
        <span className="cluster-summary-num">Mean DD</span>
        <span>Equity curve</span>
      </div>
      {ordered.map(({ clusterId, values }) => {
        const rows = parsedFeatureRows
          .filter((r) => Number(r.clusterValue) === Number(clusterId))
          .sort((a, b) => a.date.localeCompare(b.date));
        const returns = rows.map((r) => r.daily_return);
        const equity = cumulativeReturnIndex(returns);
        const isActive =
          selectedCluster !== null &&
          selectedCluster !== undefined &&
          Number(selectedCluster) === Number(clusterId);
        const ret = values.daily_return ?? null;
        const vol = values.rolling_volatility_30d ?? null;
        const dd = values.drawdown_from_30d_high ?? null;
        const color = clusterColorScale(String(clusterId));
        return (
          <button
            key={clusterId}
            type="button"
            role="row"
            className={
              isActive
                ? 'cluster-summary-row cluster-summary-row-active'
                : 'cluster-summary-row'
            }
            onClick={() => setSelectedCluster(isActive ? null : clusterId)}
          >
            <span
              className="cluster-swatch"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="cluster-summary-label">{semanticLabelForCluster(clusterId)}</span>
            <span className="cluster-summary-num">{rows.length}</span>
            <span
              className={`cluster-summary-num ${
                ret == null ? '' : ret >= 0 ? 'cluster-summary-pos' : 'cluster-summary-neg'
              }`}
            >
              {fmtPct(ret)}
            </span>
            <span className="cluster-summary-num">{fmtPct(vol)}</span>
            <span
              className={`cluster-summary-num ${
                dd != null && dd <= -0.1 ? 'cluster-summary-neg' : ''
              }`}
            >
              {fmtPct(dd, 1)}
            </span>
            <span className="cluster-summary-spark-cell">
              <MiniSpark values={equity} color={color} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
