import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

// ParallelCoordsChart — supports drag-reorder of axes and
// faint per-day rows behind heavy cluster-mean lines.
// Local interaction state only; no Zustand writes.

const WIDTH = 920;
const HEIGHT = 300;
const MARGIN = { top: 24, right: 54, bottom: 56, left: 54 };
const MAX_DAILY_ROWS = 600;

const FEATURE_LABELS = {
  daily_return: 'Daily Ret',
  open_close_change: 'Open-Close',
  high_low_range: 'High-Low Range',
  volume_zscore: 'Volume Z',
  rolling_volatility_7d: 'Vol 7D',
  rolling_volatility_30d: 'Vol 30D',
  drawdown_from_30d_high: 'DD 30D',
};

export function ParallelCoordsChart({
  features, // string[]
  dailyRows, // [{date, clusterValue, [feature]:value}]
  clusterProfiles, // [{clusterId, values:{feature:mean}}]
  clusterColorScale,
  selectedCluster,
  selectedDate,
  semanticLabelForCluster,
}) {
  const [axisOrder, setAxisOrder] = useState(features);
  const [drag, setDrag] = useState(null); // {feature, x}
  const svgRef = useRef(null);

  // Re-sync if features change externally (e.g. data reload).
  useEffect(() => {
    const same =
      axisOrder.length === features.length && axisOrder.every((f) => features.includes(f));
    if (!same) {
      setAxisOrder(features);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  const featureScale = useMemo(
    () =>
      d3
        .scalePoint()
        .domain(axisOrder)
        .range([MARGIN.left, WIDTH - MARGIN.right]),
    [axisOrder],
  );

  const verticalScales = useMemo(() => {
    const out = {};
    for (const feature of features) {
      const values = [
        ...dailyRows.map((r) => r[feature]),
        ...clusterProfiles.map((p) => p.values[feature]),
      ].filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
      const [lo, hi] = d3.extent(values);
      const minV = lo ?? 0;
      const maxV = hi ?? 1;
      const domain = minV === maxV ? [minV - 1, maxV + 1] : [minV, maxV];
      out[feature] = d3
        .scaleLinear()
        .domain(domain)
        .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
    }
    return out;
  }, [features, dailyRows, clusterProfiles]);

  const sampledRows = useMemo(() => {
    if (dailyRows.length <= MAX_DAILY_ROWS) return dailyRows;
    const stride = Math.ceil(dailyRows.length / MAX_DAILY_ROWS);
    return dailyRows.filter((_, i) => i % stride === 0);
  }, [dailyRows]);

  const lineForRow = (row, source) => {
    const points = axisOrder
      .map((feature) => {
        const value = source === 'profile' ? row.values[feature] : row[feature];
        if (value === null || value === undefined || Number.isNaN(value)) return null;
        return [featureScale(feature), verticalScales[feature](value)];
      })
      .filter(Boolean);
    if (points.length < 2) return '';
    return `M${points.map((p) => p.join(',')).join('L')}`;
  };

  // ----- Drag-reorder handlers -----
  function getSvgPoint(e) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function onAxisPointerDown(e, feature) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const { x } = getSvgPoint(e);
    setDrag({ feature, x });
  }
  function onAxisPointerMove(e) {
    if (!drag) return;
    const { x } = getSvgPoint(e);
    setDrag((prev) => (prev ? { ...prev, x } : null));
  }
  function onAxisPointerUp() {
    if (!drag) return;
    const positions = axisOrder.map((f) => ({ f, px: featureScale(f) }));
    let closest = positions[0];
    let best = Infinity;
    for (const p of positions) {
      const d = Math.abs(p.px - drag.x);
      if (d < best) {
        best = d;
        closest = p;
      }
    }
    if (closest.f !== drag.feature) {
      const next = axisOrder.filter((f) => f !== drag.feature);
      next.splice(next.indexOf(closest.f), 0, drag.feature);
      setAxisOrder(next);
    }
    setDrag(null);
  }

  const dateSelectedRows = selectedDate
    ? sampledRows.filter((row) => row.date === selectedDate)
    : sampledRows;
  const passingRows = dateSelectedRows;
  const selectedDateCluster = selectedDate
    ? dailyRows.find((row) => row.date === selectedDate)?.clusterValue
    : null;
  const targetClusterId =
    selectedDateCluster !== null && selectedDateCluster !== undefined
      ? selectedDateCluster
      : selectedCluster;
  const legendItems = [...clusterProfiles]
    .sort((a, b) => Number(a.clusterId) - Number(b.clusterId))
    .map((profile) => ({
      clusterId: profile.clusterId,
      label: semanticLabelForCluster(profile.clusterId),
      color: clusterColorScale(String(profile.clusterId)),
    }));

  return (
    <div>
      <div className="pc-toolbar-row" style={{ justifyContent: 'flex-end' }}>
        <div className="pc-legend" aria-label="Regime color legend">
          {legendItems.map((item) => (
            <span key={`pc-legend-${item.clusterId}`} className="pc-legend-item">
              <span
                className="cluster-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="timeline-chart"
        role="img"
        aria-label="Parallel coordinates feature profile plot"
        onPointerMove={(e) => {
          onAxisPointerMove(e);
        }}
        onPointerUp={() => {
          onAxisPointerUp();
        }}
      >
        {/* Faint daily rows */}
        <g className="pc-daily-rows" pointerEvents="none">
          {passingRows.map((row) => {
            const isSelectedCluster =
              targetClusterId !== null &&
              targetClusterId !== undefined &&
              Number(targetClusterId) === Number(row.clusterValue);
            const isSelectedDay = selectedDate === row.date;
            const opacity = isSelectedDay
              ? 0.52
              : targetClusterId === null || targetClusterId === undefined
                ? 0.16
                : isSelectedCluster
                  ? 0.22
                  : 0.04;
            return (
              <path
                key={`pcd-${row.date}`}
                d={lineForRow(row, 'daily')}
                fill="none"
                stroke={clusterColorScale(String(row.clusterValue))}
                strokeWidth={isSelectedDay ? 1.3 : 0.7}
                opacity={opacity}
                className="pc-daily-row"
              />
            );
          })}
        </g>

        {/* Cluster mean lines on top.
            Always show all regime means for comparison.
            The selected regime is emphasized; other regimes are muted. */}
        <g className="pc-mean-lines">
          {clusterProfiles.map((profile) => {
            const isSelected =
              targetClusterId !== null &&
              targetClusterId !== undefined &&
              Number(targetClusterId) === Number(profile.clusterId);
            const hasTargetCluster =
              targetClusterId !== null && targetClusterId !== undefined;

            return (
              <path
                key={`pcm-${profile.clusterId}`}
                d={lineForRow(profile, 'profile')}
                fill="none"
                stroke={clusterColorScale(String(profile.clusterId))}
                strokeWidth={!hasTargetCluster ? 2.6 : 4.2}
                opacity={!hasTargetCluster ? 0.78 : isSelected ? 0.98 : 0.22}
                className="profile-line"
              />
            );
          })}
        </g>

        {/* Axis verticals + draggable labels + brush handles */}
        {axisOrder.map((feature) => {
          const cx = featureScale(feature);
          const isDragging = drag && drag.feature === feature;
          const renderX = isDragging ? drag.x : cx;
          const scale = verticalScales[feature];

          return (
            <g key={feature} transform={`translate(${renderX}, 0)`}>
              <line
                x1={0}
                x2={0}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                className="chart-gridline chart-gridline-vertical"
              />

              {/* Axis-extreme tick labels */}
              <text
                x={0}
                y={MARGIN.top - 4}
                textAnchor="middle"
                className="chart-axis-label"
              >
                {scale.domain()[1].toFixed(2)}
              </text>
              <text
                x={0}
                y={HEIGHT - MARGIN.bottom + 12}
                textAnchor="middle"
                className="chart-axis-label"
              >
                {scale.domain()[0].toFixed(2)}
              </text>

              {/* Drag handle = axis title */}
              <g
                onPointerDown={(e) => onAxisPointerDown(e, feature)}
                style={{ cursor: 'grab' }}
              >
                <rect
                  x={-46}
                  y={HEIGHT - MARGIN.bottom + 18}
                  width={92}
                  height={20}
                  rx={4}
                  className="pc-axis-handle"
                />
                <text
                  y={HEIGHT - MARGIN.bottom + 32}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {FEATURE_LABELS[feature] ?? feature.replaceAll('_', ' ')}
                </text>
              </g>
            </g>
          );
        })}
      </svg>


    </div>
  );
}
