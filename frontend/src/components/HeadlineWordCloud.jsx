import React, { useEffect, useRef, useState } from 'react';
import cloud from 'd3-cloud';
import * as d3 from 'd3';
import { tokenizeHeadlines } from '../utils/derived.js';

const WIDTH = 520;
const HEIGHT = 220;

function toneColor(meanTone) {
  if (meanTone === null || meanTone === undefined || Number.isNaN(meanTone)) return '#ced4da';
  if (meanTone > 0.5) return '#2f9e44';
  if (meanTone < -0.5) return '#d9485f';
  return '#ced4da';
}

export function HeadlineWordCloud({ events }) {
  const [layout, setLayout] = useState([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const tokens = tokenizeHeadlines(events).slice(0, 40);
    if (tokens.length === 0) {
      setLayout([]);
      return undefined;
    }
    const sizeScale = d3
      .scaleSqrt()
      .domain([1, d3.max(tokens, (t) => t.count) ?? 1])
      .range([12, 38]);

    cloud()
      .size([WIDTH, HEIGHT])
      .words(
        tokens.map((t) => ({
          text: t.word,
          size: sizeScale(t.count),
          count: t.count,
          tone: t.meanTone,
        })),
      )
      .padding(2)
      .rotate(() => (Math.random() < 0.2 ? 90 : 0))
      .font('Inter, Segoe UI, sans-serif')
      .fontSize((d) => d.size)
      .on('end', (placed) => {
        if (!cancelledRef.current) setLayout(placed);
      })
      .start();

    return () => {
      cancelledRef.current = true;
    };
  }, [events]);

  if (!events || events.length === 0 || layout.length === 0) {
    return (
      <div className="placeholder-box placeholder-box-small">
        <span className="placeholder-label">No headline tokens available.</span>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      role="img"
      aria-label="Headline word cloud colored by mean tone"
    >
      <g transform={`translate(${WIDTH / 2}, ${HEIGHT / 2})`}>
        {layout.map((w) => (
          <text
            key={`${w.text}-${w.x}-${w.y}`}
            transform={`translate(${w.x}, ${w.y}) rotate(${w.rotate})`}
            textAnchor="middle"
            fontSize={w.size}
            fontFamily="Inter, Segoe UI, sans-serif"
            fontWeight={600}
            fill={toneColor(w.tone)}
          >
            {w.text}
          </text>
        ))}
      </g>
    </svg>
  );
}
