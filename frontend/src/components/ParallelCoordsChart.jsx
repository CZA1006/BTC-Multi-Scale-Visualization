import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

// ParallelCoordsChart — supports drag-reorder of axes, per-axis range brushing,
// and faint per-day rows behind heavy cluster-mean lines.
// Local interaction state only; no Zustand writes.

const WIDTH = 920;
const HEIGHT = 320;
const MARGIN = { top: 24, right: 28, bottom: 56, left: 28 };
const MAX_DAILY_ROWS = 600;

export function ParallelCoordsChart({
  features, // string[]
  dailyRows, // [{date, clusterValue, [feature]:value}]
  clusterProfiles, // [{clusterId, values:{feature:mean}}]
  clusterColorScale,
  selectedCluster,
  semanticLabelForCluster,
}) {
  const [axisOrder, setAxisOrder] = useState(features);
  const [axisBrushes, setAxisBrushes] = useState({}); // {feature: [min,max]}
  const [drag, setDrag] = useState(null); // {feature, x}
  const [activeBrush, setActiveBrush] = useState(null); // {feature, startY, currentY}
  const svgRef = useRef(null);

  // Re-sync if features change externally (e.g. data reload).
  useEffect(() => {
    const same =
      axisOrder.length === features.length && axisOrder.every((f) => features.includes(f));
    if (!same) {
      setAxisOrder(features);
      setAxisBrushes({});
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

  const passesBrushes = (row) => {
    for (const [feature, range] of Object.entries(axisBrushes)) {
      const v = row[feature];
      if (v === null || v === undefined || Number.isNaN(v)) return false;
      if (v < range[0] || v > range[1]) return false;
    }
    return true;
  };

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

  // ----- Brush handlers -----
  function onBrushPointerDown(e, feature) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const { y } = getSvgPoint(e);
    setActiveBrush({ feature, startY: y, currentY: y });
  }
  function onBrushPointerMove(e) {
    if (!activeBrush) return;
    const { y } = getSvgPoint(e);
    setActiveBrush((prev) => (prev ? { ...prev, currentY: y } : null));
  }
  function onBrushPointerUp() {
    if (!activeBrush) return;
    const scale = verticalScales[activeBrush.feature];
    const yMin = Math.min(activeBrush.startY, activeBrush.currentY);
    const yMax = Math.max(activeBrush.startY, activeBrush.currentY);
    if (Math.abs(yMax - yMin) < 6) {
      setActiveBrush(null);
      return;
    }
    const valueHi = scale.invert(yMin); // lower y = higher value
    const valueLo = scale.invert(yMax);
    setAxisBrushes((prev) => ({ ...prev, [activeBrush.feature]: [valueLo, valueHi] }));
    setActiveBrush(null);
  }
  function clearBrush(feature) {
    setAxisBrushes((prev) => {
      const next = { ...prev };
      delete next[feature];
      return next;
    });
  }

  const hasBrushes = Object.keys(axisBrushes).length > 0;
  const passingRows = hasBrushes ? sampledRows.filter(passesBrushes) : sampledRows;
  const passingCount = passingRows.length;
  const passingRatio = sampledRows.length > 0 ? passingCount / sampledRows.length : 0;

  return (
    <div>
      <div className="control-row" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className="range-button"
          onClick={() => setAxisOrder(features)}
        >
          Reset axes
        </button>
        <button
          type="button"
          className="range-button"
          onClick={() => setAxisBrushes({})}
        >
          Clear brushes ({Object.keys(axisBrushes).length})
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="timeline-chart"
        role="img"
        aria-label="Parallel coordinates plot with drag-reorder and brushing"
        onPointerMove={(e) => {
          onAxisPointerMove(e);
          onBrushPointerMove(e);
        }}
        onPointerUp={(e) => {
          onAxisPointerUp(e);
          onBrushPointerUp(e);
        }}
      >
        {/* Faint daily rows */}
        <g className="pc-daily-rows" pointerEvents="none">
          {sampledRows.map((row) => {
            const passing = !hasBrushes || passesBrushes(row);
            const isSelectedCluster =
              selectedCluster !== null &&
              selectedCluster !== undefined &&
              Number(selectedCluster) === Number(row.clusterValue);
            const opacity = passing
              ? selectedCluster === null || selectedCluster === undefined
                ? 0.18
                : isSelectedCluster
                  ? 0.32
                  : 0.06
              : 0.02;
            return (
              <path
                key={`pcd-${row.date}`}
                d={lineForRow(row, 'daily')}
                fill="none"
                stroke={clusterColorScale(String(row.clusterValue))}
                strokeWidth={0.7}
                opacity={opacity}
                className="pc-daily-row"
              />
            );
          })}
        </g>

        {/* Cluster mean lines on top */}
        <g className="pc-mean-lines">
          {clusterProfiles.map((profile) => {
            const isSelected =
              selectedCluster !== null &&
              selectedCluster !== undefined &&
              Number(selectedCluster) === Number(profile.clusterId);
            return (
              <path
                key={`pcm-${profile.clusterId}`}
                d={lineForRow(profile, 'profile')}
                fill="none"
                stroke={
                  selectedCluster === null || selectedCluster === undefined || isSelected
                    ? clusterColorScale(String(profile.clusterId))
                    : '#4a5670'
                }
                strokeWidth={isSelected ? 3.6 : 2}
                opacity={
                  selectedCluster === null || selectedCluster === undefined || isSelected
                    ? 0.95
                    : 0.3
                }
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
          const brush = axisBrushes[feature];
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

              {/* Brush hit area + active brush rect */}
              <rect
                x={-12}
                width={24}
                y={MARGIN.top}
                height={HEIGHT - MARGIN.top - MARGIN.bottom}
                fill="transparent"
                style={{ cursor: 'ns-resize' }}
                onPointerDown={(e) => onBrushPointerDown(e, feature)}
                onDoubleClick={() => clearBrush(feature)}
              />
              {brush ? (
                <rect
                  x={-8}
                  width={16}
                  y={scale(brush[1])}
                  height={Math.max(2, scale(brush[0]) - scale(brush[1]))}
                  className="pc-axis-brush"
                  pointerEvents="none"
                />
              ) : null}
              {activeBrush && activeBrush.feature === feature ? (
                <rect
                  x={-8}
                  width={16}
                  y={Math.min(activeBrush.startY, activeBrush.currentY)}
                  height={Math.abs(activeBrush.currentY - activeBrush.startY)}
                  className="pc-axis-brush pc-axis-brush-active"
                  pointerEvents="none"
                />
              ) : null}

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
                  {feature.replaceAll('_', ' ')}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      <div className="chart-caption-row">
        <p className="chart-caption">Daily rows: {sampledRows.length}</p>
        <p className="chart-caption">
          Brushed: {hasBrushes ? `${passingCount} (${(passingRatio * 100).toFixed(0)}%)` : 'none'}
        </p>
        <p className="chart-caption">Drag axis label to reorder · Drag along axis to brush · Double-click axis to clear</p>
      </div>
    </div>
  );
}
