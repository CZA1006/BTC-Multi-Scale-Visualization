import React, { useMemo } from 'react';

const DRIVER_CONFIG = {
  crypto_policy: {
    label: 'Crypto policy',
    color: '#f7931a',
    keywords: [
      'crypto',
      'cryptocurrency',
      'bitcoin',
      'btc',
      'legislation',
      'regulation',
      'regulatory',
      'sec',
      'etf',
      'reserve',
      'policy',
    ],
  },
  election_policy: {
    label: 'Election / policy',
    color: '#8da0cb',
    keywords: [
      'election',
      'trump',
      'harris',
      'democrat',
      'republican',
      'capitol',
      'campaign',
      'vote',
      'administration',
    ],
  },
  macro_fed: {
    label: 'Macro / Fed',
    color: '#66c2a5',
    keywords: [
      'fed',
      'powell',
      'rate',
      'rates',
      'inflation',
      'dollar',
      'treasury',
      'yield',
      'liquidity',
      'risk',
    ],
  },
  market_sentiment: {
    label: 'Market sentiment',
    color: '#e5c494',
    keywords: [
      'rally',
      'surge',
      'selloff',
      'crash',
      'drop',
      'gain',
      'loss',
      'risk-on',
      'risk-off',
      'fear',
      'outflow',
      'inflow',
    ],
  },
  geopolitical_risk: {
    label: 'Geopolitical risk',
    color: '#d65a5a',
    keywords: ['war', 'iran', 'ukraine', 'russia', 'middle east', 'attack', 'conflict', 'tension'],
  },
  other: {
    label: 'Other context',
    color: '#94a3b8',
    keywords: [],
  },
};

const DRIVER_ORDER = [
  'crypto_policy',
  'election_policy',
  'macro_fed',
  'market_sentiment',
  'geopolitical_risk',
  'other',
];

function inferDriver(event) {
  const text = `${event?.category ?? ''} ${event?.headline ?? ''}`.toLowerCase();

  for (const key of DRIVER_ORDER) {
    if (key === 'other') continue;
    const config = DRIVER_CONFIG[key];
    if (config.keywords.some((keyword) => text.includes(keyword))) {
      return key;
    }
  }

  return 'other';
}

function truncate(text, maxLength = 92) {
  const value = String(text ?? '').trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function HeadlineWordCloud({ events = [] }) {
  const drivers = useMemo(() => {
    const buckets = new Map(
      DRIVER_ORDER.map((key) => [
        key,
        {
          key,
          ...DRIVER_CONFIG[key],
          count: 0,
          examples: [],
        },
      ]),
    );

    for (const event of events) {
      const key = inferDriver(event);
      const bucket = buckets.get(key) ?? buckets.get('other');
      bucket.count += 1;

      if (bucket.examples.length < 2 && event?.headline) {
        bucket.examples.push(event.headline);
      }
    }

    return DRIVER_ORDER.map((key) => buckets.get(key))
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count || DRIVER_ORDER.indexOf(left.key) - DRIVER_ORDER.indexOf(right.key));
  }, [events]);

  const maxCount = Math.max(...drivers.map((item) => item.count), 1);
  const total = events.length;

  if (drivers.length === 0) {
    return (
      <div className="placeholder-box placeholder-box-small">
        <span className="placeholder-label">No headline driver signals available.</span>
      </div>
    );
  }

  return (
    <div
      className="asset-context-card"
      style={{
        padding: 18,
        height: 380,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <p className="asset-context-ticker" style={{ marginBottom: 4 }}>
            Headline relevance drivers
          </p>
          <p className="state-label" style={{ margin: 0 }}>
            Groups headlines by the market channel that could affect BTC.
          </p>
        </div>
        <div
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.72rem',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {total} headlines
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, flex: 1 }}>
        {drivers.map((driver) => {
          const widthPct = Math.max(8, (driver.count / maxCount) * 100);
          return (
            <div
              key={driver.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '132px minmax(0, 1fr) 36px',
                gap: 10,
                alignItems: 'start',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    color: 'var(--text-main)',
                    fontWeight: 700,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2,
                      background: driver.color,
                      flex: '0 0 auto',
                    }}
                  />
                  {driver.label}
                </div>
                {driver.examples[0] ? (
                  <div
                    className="state-label"
                    style={{
                      margin: '4px 0 0 16px',
                      fontSize: '0.68rem',
                      lineHeight: 1.25,
                    }}
                    title={driver.examples[0]}
                  >
                    {truncate(driver.examples[0])}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  height: 10,
                  marginTop: 4,
                  borderRadius: 999,
                  background: 'rgba(148, 163, 184, 0.14)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: driver.color,
                    boxShadow: `0 0 18px ${driver.color}33`,
                  }}
                />
              </div>

              <span
                style={{
                  color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'right',
                  fontWeight: 700,
                }}
              >
                {driver.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
