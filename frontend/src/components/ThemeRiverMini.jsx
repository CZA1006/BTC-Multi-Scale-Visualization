import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { THEME_LIST, bucketHeadlinesByThemeHour } from '../utils/derived.js';

const WIDTH = 520;
const HEIGHT = 120;
const MARGIN = { top: 14, right: 12, bottom: 22, left: 32 };

const THEME_COLORS = {
  regulation: '#8da0cb',
  war:        '#d62728',
  election:   '#ffd92f',
  crypto:     '#f7931a',
  other:      '#6b7890',
};

export function ThemeRiverMini({ events }) {
  const { paths, totalByHour, hasData } = useMemo(() => {
    const buckets = bucketHeadlinesByThemeHour(events);
    const total = buckets.reduce((acc, b) => acc + THEME_LIST.reduce((s, k) => s + b[k], 0), 0);
    if (total === 0) {
      return { paths: [], totalByHour: [], hasData: false };
    }
    const x = d3
      .scaleLinear()
      .domain([0, 23])
      .range([MARGIN.left, WIDTH - MARGIN.right]);

    const stackGen = d3
      .stack()
      .keys(THEME_LIST)
      .offset(d3.stackOffsetSilhouette);
    const series = stackGen(buckets);
    const yMax = d3.max(series, (layer) => d3.max(layer, (d) => Math.abs(d[1] - d[0]))) ?? 1;
    const y = d3
      .scaleLinear()
      .domain([-yMax, yMax])
      .range([HEIGHT - MARGIN.bottom, MARGIN.top]);

    const area = d3
      .area()
      .x((_, i) => x(i))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveBasis);

    return {
      paths: series.map((layer) => ({
        key: layer.key,
        d: area(layer) ?? '',
      })),
      totalByHour: buckets.map((b) => THEME_LIST.reduce((s, k) => s + b[k], 0)),
      hasData: true,
    };
  }, [events]);

  if (!hasData) {
    return (
      <div className="placeholder-box placeholder-box-small">
        <span className="placeholder-label">No themed headline activity for this day.</span>
      </div>
    );
  }

  const xTickStep = 4;
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT + 28}
      role="img"
      aria-label="ThemeRiver of hourly headline themes"
    >
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill={THEME_COLORS[p.key] ?? '#888'}
          opacity={0.8}
        >
          <title>{p.key}</title>
        </path>
      ))}
      {Array.from({ length: 24 / xTickStep + 1 }, (_, i) => i * xTickStep).map((h) => (
        <text
          key={`tr-x-${h}`}
          x={MARGIN.left + ((WIDTH - MARGIN.left - MARGIN.right) * h) / 23}
          y={HEIGHT - 4}
          textAnchor="middle"
          className="chart-axis-label"
        >
          {String(h).padStart(2, '0')}:00
        </text>
      ))}
      <g transform={`translate(${MARGIN.left}, ${HEIGHT + 14})`}>
        {THEME_LIST.map((key, i) => (
          <g key={key} transform={`translate(${i * 92}, 0)`}>
            <rect width="10" height="10" fill={THEME_COLORS[key]} rx="2" />
            <text x="14" y="9" className="chart-axis-label">
              {key}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
