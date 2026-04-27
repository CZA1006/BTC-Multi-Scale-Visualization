import React, { useMemo } from 'react';

/**
 * Compact 0.0–1.0 probability sparkline for a Polymarket market.
 *
 * Encodings (per VISUAL_ENCODINGS.md §2.11):
 * - x = time (ordered position on common scale, Mackinlay #1)
 * - y = YES probability ∈ [0, 1] (quantitative position, Mackinlay #1)
 * - hue = sign of (price_at_date − 0.5): red below 0.5, green above
 * - selected-date marker: vertical hairline + filled dot at the
 *   observed point closest to selectedDate
 */
export function PolymarketSparkline({
  history,
  selectedDate,
  width = 140,
  height = 32,
  padX = 2,
  padY = 3,
}) {
  const dims = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return null;

    const ts = history.map((d) => d.t);
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts);
    const tSpan = Math.max(1, tMax - tMin);

    const xOf = (t) => padX + ((t - tMin) / tSpan) * (width - 2 * padX);
    const yOf = (p) => height - padY - p * (height - 2 * padY);

    const path = history
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(d.t).toFixed(2)},${yOf(d.p).toFixed(2)}`)
      .join(' ');

    let target = null;
    if (selectedDate) {
      const targetTs = Math.floor(new Date(`${selectedDate}T00:00:00Z`).getTime() / 1000);
      target = history.reduce((best, d) =>
        best === null || Math.abs(d.t - targetTs) < Math.abs(best.t - targetTs) ? d : best,
      null);
    }

    return { xOf, yOf, path, target, tMin, tMax };
  }, [history, selectedDate, width, height, padX, padY]);

  if (!dims) return null;

  const lastPrice = history[history.length - 1].p;
  const stroke = lastPrice >= 0.5 ? 'var(--pos, #2ca02c)' : 'var(--neg, #d62728)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Polymarket probability history"
      style={{ display: 'block' }}
    >
      {/* baseline at p=0.5 */}
      <line
        x1={padX}
        x2={width - padX}
        y1={dims.yOf(0.5)}
        y2={dims.yOf(0.5)}
        stroke="rgba(255,255,255,0.18)"
        strokeDasharray="2 3"
      />
      <path d={dims.path} fill="none" stroke={stroke} strokeWidth="1.4" />
      {dims.target ? (
        <g>
          <line
            x1={dims.xOf(dims.target.t)}
            x2={dims.xOf(dims.target.t)}
            y1={padY}
            y2={height - padY}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.8"
          />
          <circle
            cx={dims.xOf(dims.target.t)}
            cy={dims.yOf(dims.target.p)}
            r="2.4"
            fill={stroke}
            stroke="rgba(0,0,0,0.65)"
            strokeWidth="0.6"
          />
        </g>
      ) : null}
    </svg>
  );
}
