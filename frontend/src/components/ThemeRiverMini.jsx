import React, { useMemo } from 'react';

const THEME_COLORS = {
  election: '#8da0cb',
  macro: '#f7931a',
  regulation: '#e78ac3',
  crypto: '#66c2a5',
  war: '#d65a5a',
  covid: '#ffd92f',
  other: '#94a3b8',
};

const THEME_LABELS = {
  election: 'Election',
  macro: 'Macro',
  regulation: 'Regulation',
  crypto: 'Crypto',
  war: 'War',
  covid: 'COVID',
  other: 'Other',
};

function toHour(timestamp) {
  if (!timestamp) return null;
  const raw = String(timestamp);
  const match = raw.match(/[T\s](\d{2}):/);
  if (match) return Number(match[1]);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCHours();
}

function inferTheme(event) {
  const direct = String(event?.category ?? event?.theme ?? '').toLowerCase();
  const headline = String(event?.headline ?? '').toLowerCase();
  const text = `${direct} ${headline}`;

  if (text.includes('election') || text.includes('trump') || text.includes('harris') || text.includes('vote')) {
    return 'election';
  }
  if (text.includes('fed') || text.includes('powell') || text.includes('inflation') || text.includes('dollar') || text.includes('rate')) {
    return 'macro';
  }
  if (text.includes('regulation') || text.includes('regulatory') || text.includes('sec') || text.includes('legislation') || text.includes('law')) {
    return 'regulation';
  }
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('btc') || text.includes('etf')) {
    return 'crypto';
  }
  if (text.includes('war') || text.includes('ukraine') || text.includes('russia') || text.includes('iran')) {
    return 'war';
  }
  if (text.includes('covid') || text.includes('pandemic')) {
    return 'covid';
  }
  return 'other';
}

export function ThemeRiverMini({ events = [] }) {
  const { themeOrder, rows, maxTotal } = useMemo(() => {
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      election: 0,
      macro: 0,
      regulation: 0,
      crypto: 0,
      war: 0,
      covid: 0,
      other: 0,
    }));

    for (const event of events) {
      const hour = toHour(event?.timestamp);
      if (hour === null || hour < 0 || hour > 23) continue;
      hourly[hour][inferTheme(event)] += 1;
    }

    const ordered = Object.keys(THEME_COLORS)
      .map((theme) => ({
        theme,
        total: hourly.reduce((sum, row) => sum + row[theme], 0),
      }))
      .filter((item) => item.total > 0)
      .sort((left, right) => right.total - left.total)
      .map((item) => item.theme);

    const visibleThemes = ordered.length > 0 ? ordered : ['other'];
    const maxHourlyTotal = Math.max(
      ...hourly.map((row) => visibleThemes.reduce((sum, theme) => sum + row[theme], 0)),
      1,
    );

    return {
      themeOrder: visibleThemes,
      rows: hourly,
      maxTotal: maxHourlyTotal,
    };
  }, [events]);

  const width = 760;
  const height = 300;
  const margin = { top: 16, right: 30, bottom: 42, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const barGap = 2;
  const barWidth = innerWidth / 24 - barGap;
  const yScale = (value) => margin.top + innerHeight - (value / maxTotal) * innerHeight;

  return (
    <div
      className="asset-context-card"
      style={{
        padding: 18,
        height: 380,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <p className="asset-context-ticker" style={{ marginBottom: 4 }}>
            Hourly news theme timeline
          </p>
          <p className="state-label" style={{ margin: 0 }}>
            Stacked count of selected-day headlines by UTC hour.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            maxWidth: 360,
            color: 'var(--text-muted)',
            fontSize: '0.72rem',
          }}
        >
          {themeOrder.map((theme) => (
            <span key={theme} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: THEME_COLORS[theme],
                }}
              />
              {THEME_LABELS[theme]}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Hourly news theme timeline"
        style={{ display: 'block', overflow: 'visible', flex: 1 }}
      >
        {[0, Math.ceil(maxTotal / 2), maxTotal].map((tick) => (
          <g key={`grid-${tick}`}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="rgba(148, 163, 184, 0.18)"
              strokeWidth="1"
            />
            <text
              x={margin.left - 10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="chart-axis-label"
            >
              {tick}
            </text>
          </g>
        ))}

        {rows.map((row) => {
          const x = margin.left + row.hour * (innerWidth / 24);
          let running = 0;

          return (
            <g key={row.hour}>
              {themeOrder.map((theme) => {
                const value = row[theme];
                if (value <= 0) return null;

                const yTop = yScale(running + value);
                const yBottom = yScale(running);
                running += value;

                return (
                  <rect
                    key={`${row.hour}-${theme}`}
                    x={x}
                    y={yTop}
                    width={Math.max(1, barWidth)}
                    height={Math.max(1, yBottom - yTop)}
                    rx={2}
                    fill={THEME_COLORS[theme]}
                    opacity={0.88}
                  >
                    <title>
                      {`${String(row.hour).padStart(2, '0')}:00 · ${THEME_LABELS[theme]}: ${value}`}
                    </title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {[0, 4, 8, 12, 16, 20, 23].map((hour) => (
          <text
            key={`hour-${hour}`}
            x={margin.left + hour * (innerWidth / 24) + barWidth / 2}
            y={height - 18}
            textAnchor="middle"
            className="chart-axis-label"
          >
            {`${String(hour).padStart(2, '0')}:00`}
          </text>
        ))}

        <text
          x={margin.left + innerWidth / 2}
          y={height - 3}
          textAnchor="middle"
          className="chart-axis-label"
          style={{ fontSize: '0.68rem' }}
        >
          UTC hour
        </text>
      </svg>
    </div>
  );
}
