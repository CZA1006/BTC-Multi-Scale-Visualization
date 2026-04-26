import React, { useMemo } from 'react';
import * as d3 from 'd3';

// Horizon graph: mirror-folded layered area, n bands per side. Zero-baseline.
// Western convention: positive = green (up), negative = red (down) — consistent
// with the Macro calendar heatmap. Designed for B&W legibility because each
// band has progressively darker luminance.

const POSITIVE_BANDS = ['#a6d96a', '#66bd63', '#1a9850', '#006837'];
const NEGATIVE_BANDS = ['#fdae61', '#d73027', '#a50026', '#67001f'];

export function HorizonChart({
  rows, // [{ parsedDate, value }]
  xScale,
  width,
  height = 56,
  margin = { top: 4, right: 22, bottom: 14, left: 56 },
  bands = 4,
  title,
  valueFormatter = (v) => v?.toFixed?.(4) ?? 'N/A',
  centerOnZero = true,
}) {
  const innerHeight = height - margin.top - margin.bottom;

  const { posPaths, negPaths, maxAbs } = useMemo(() => {
    const valid = rows.filter(
      (r) => r && r.value !== null && r.value !== undefined && !Number.isNaN(r.value),
    );
    if (valid.length < 2) {
      return { posPaths: [], negPaths: [], maxAbs: 0 };
    }
    const extent = d3.extent(valid, (r) => r.value);
    const maxAbsLocal = centerOnZero
      ? Math.max(Math.abs(extent[0] ?? 0), Math.abs(extent[1] ?? 0))
      : Math.max(extent[1] ?? 0, 0);
    if (maxAbsLocal === 0) {
      return { posPaths: [], negPaths: [], maxAbs: 0 };
    }

    const bandSize = maxAbsLocal / bands;
    const yBand = d3.scaleLinear().domain([0, bandSize]).range([innerHeight, 0]);

    // Build per-band folded series — for band k, clip to [k*bandSize, (k+1)*bandSize]
    // then subtract k*bandSize so each band re-occupies the same vertical strip.
    const buildBandPath = (sign, k) => {
      const lo = k * bandSize;
      const hi = (k + 1) * bandSize;
      const folded = valid.map((r) => {
        const abs = sign === 'pos' ? r.value : -r.value;
        const clipped = Math.max(lo, Math.min(hi, abs));
        const offset = clipped - lo;
        return { ...r, _y: offset };
      });
      const area = d3
        .area()
        .x((r) => xScale(r.parsedDate))
        .y0(innerHeight)
        .y1((r) => yBand(Math.max(0, Math.min(bandSize, r._y))))
        .curve(d3.curveMonotoneX);
      return area(folded) ?? '';
    };

    const posPathsLocal = [];
    const negPathsLocal = [];
    for (let k = 0; k < bands; k += 1) {
      posPathsLocal.push(buildBandPath('pos', k));
      negPathsLocal.push(buildBandPath('neg', k));
    }
    return { posPaths: posPathsLocal, negPaths: negPathsLocal, maxAbs: maxAbsLocal };
  }, [rows, xScale, innerHeight, bands, centerOnZero]);

  return (
    <g transform={`translate(0, ${margin.top})`}>
      {title ? (
        <text x={margin.left} y={-2} className="chart-axis-title">
          {title}
        </text>
      ) : null}

      {/* Negative layers (rendered first so positive sits on top visually) */}
      {negPaths.map((d, i) => (
        <path
          key={`hneg-${i}`}
          d={d}
          fill={NEGATIVE_BANDS[i]}
          opacity={0.85}
        />
      ))}
      {posPaths.map((d, i) => (
        <path
          key={`hpos-${i}`}
          d={d}
          fill={POSITIVE_BANDS[i]}
          opacity={0.85}
        />
      ))}

      {/* Zero baseline */}
      <line
        x1={margin.left}
        x2={width - margin.right}
        y1={innerHeight}
        y2={innerHeight}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.5}
      />

      {/* Right-side scale hint */}
      <text
        x={width - margin.right + 4}
        y={innerHeight / 2}
        className="chart-axis-label"
        dominantBaseline="middle"
      >
        ±{valueFormatter(maxAbs)}
      </text>
    </g>
  );
}
