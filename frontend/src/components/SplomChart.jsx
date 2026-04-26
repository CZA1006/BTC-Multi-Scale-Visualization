import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';

// Curated 4-feature SPLOM. Diagonal cells render a KDE ridge of the feature.
// Linked highlighting: hover/click a point in any cell propagates to all cells.

const SPLOM_FEATURES = [
  'daily_return',
  'rolling_volatility_30d',
  'volume_zscore',
  'drawdown_from_30d_high',
];

const CELL_SIZE = 130;
const CELL_PAD = 8;
const HEADER = 22;

export function SplomChart({
  dailyRows,
  clusterColorScale,
  selectedCluster,
  selectedDate,
  setSelectedDate,
  setSelectedCluster,
}) {
  const [hoveredDate, setHoveredDate] = useState(null);

  const validRows = useMemo(
    () =>
      dailyRows.filter((r) =>
        SPLOM_FEATURES.every(
          (f) => r[f] !== null && r[f] !== undefined && !Number.isNaN(r[f]),
        ),
      ),
    [dailyRows],
  );

  const scales = useMemo(() => {
    const out = {};
    for (const f of SPLOM_FEATURES) {
      const [lo, hi] = d3.extent(validRows, (r) => r[f]);
      const minV = lo ?? 0;
      const maxV = hi ?? 1;
      const dom = minV === maxV ? [minV - 1, maxV + 1] : [minV, maxV];
      out[f] = { domain: dom };
    }
    return out;
  }, [validRows]);

  function makeCellScales(fx, fy) {
    return {
      x: d3.scaleLinear().domain(scales[fx].domain).range([CELL_PAD, CELL_SIZE - CELL_PAD]),
      y: d3.scaleLinear().domain(scales[fy].domain).range([CELL_SIZE - CELL_PAD, CELL_PAD]),
    };
  }

  function kdeRidge(values, domain, samples = 40) {
    if (values.length < 4) return '';
    const bw = (domain[1] - domain[0]) / 12;
    const xs = d3.range(samples).map((i) => domain[0] + (i / (samples - 1)) * (domain[1] - domain[0]));
    const ys = xs.map((x) => {
      let s = 0;
      for (const v of values) {
        const u = (x - v) / bw;
        s += Math.exp(-0.5 * u * u);
      }
      return s / (values.length * bw * Math.sqrt(2 * Math.PI));
    });
    const yMax = Math.max(...ys, 1e-9);
    const x = d3.scaleLinear().domain(domain).range([CELL_PAD, CELL_SIZE - CELL_PAD]);
    const y = d3.scaleLinear().domain([0, yMax]).range([CELL_SIZE - CELL_PAD, CELL_PAD + 4]);
    const area = d3
      .area()
      .x((_, i) => x(xs[i]))
      .y0(CELL_SIZE - CELL_PAD)
      .y1((_, i) => y(ys[i]))
      .curve(d3.curveBasis);
    return area(ys) ?? '';
  }

  const n = SPLOM_FEATURES.length;
  const totalSize = HEADER + n * CELL_SIZE;

  return (
    <svg
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      width="100%"
      role="img"
      aria-label="Scatterplot matrix (SPLOM)"
    >
      {/* Column headers */}
      {SPLOM_FEATURES.map((f, c) => (
        <text
          key={`col-${f}`}
          x={HEADER + c * CELL_SIZE + CELL_SIZE / 2}
          y={14}
          textAnchor="middle"
          className="chart-axis-label"
        >
          {f.replaceAll('_', ' ')}
        </text>
      ))}

      {/* Row headers (rotated) */}
      {SPLOM_FEATURES.map((f, r) => (
        <text
          key={`row-${f}`}
          x={10}
          y={HEADER + r * CELL_SIZE + CELL_SIZE / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 10, ${HEADER + r * CELL_SIZE + CELL_SIZE / 2})`}
          className="chart-axis-label"
        >
          {f.replaceAll('_', ' ')}
        </text>
      ))}

      {SPLOM_FEATURES.map((fy, r) =>
        SPLOM_FEATURES.map((fx, c) => {
          const tx = HEADER + c * CELL_SIZE;
          const ty = HEADER + r * CELL_SIZE;
          const isDiag = r === c;
          const cell = makeCellScales(fx, fy);
          return (
            <g key={`cell-${r}-${c}`} transform={`translate(${tx}, ${ty})`}>
              <rect
                x={0}
                y={0}
                width={CELL_SIZE}
                height={CELL_SIZE}
                className="splom-cell"
              />
              {isDiag ? (
                <path
                  d={kdeRidge(validRows.map((row) => row[fx]), scales[fx].domain)}
                  fill="rgba(247,147,26,0.35)"
                  stroke="#f7931a"
                  strokeWidth={0.8}
                />
              ) : (
                validRows.map((row) => {
                  const isHovered = hoveredDate === row.date;
                  const isSelectedDate = selectedDate === row.date;
                  const isSelectedCluster =
                    selectedCluster !== null &&
                    selectedCluster !== undefined &&
                    Number(selectedCluster) === Number(row.clusterValue);
                  const opacity = isSelectedDate || isHovered
                    ? 1
                    : selectedCluster !== null && selectedCluster !== undefined
                      ? isSelectedCluster
                        ? 0.85
                        : 0.18
                      : 0.5;
                  const radius = isSelectedDate ? 4 : isHovered ? 3.5 : 2.2;
                  return (
                    <circle
                      key={`p-${row.date}-${r}-${c}`}
                      cx={cell.x(row[fx])}
                      cy={cell.y(row[fy])}
                      r={radius}
                      fill={clusterColorScale(String(row.clusterValue))}
                      stroke={isSelectedDate ? '#ffffff' : 'rgba(11,15,23,0.5)'}
                      strokeWidth={isSelectedDate ? 1.5 : 0.4}
                      opacity={opacity}
                      onMouseEnter={() => setHoveredDate(row.date)}
                      onMouseLeave={() => setHoveredDate(null)}
                      onClick={() => {
                        setSelectedDate(row.date);
                        if (row.clusterValue !== null && row.clusterValue !== undefined) {
                          setSelectedCluster(row.clusterValue);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{`${row.date} | ${fx}=${row[fx]?.toFixed?.(3)} | ${fy}=${row[fy]?.toFixed?.(3)}`}</title>
                    </circle>
                  );
                })
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}
