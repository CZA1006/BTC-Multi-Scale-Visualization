import React from 'react';
import * as d3 from 'd3';
import { useOverview } from '../hooks/useOverview.js';
import { pctChange, rollingStd, pearson } from '../utils/derived.js';

// Bloomberg-inspired KPI strip: label · big tabular value · delta chip · sparkline.
// Pure consumer of useOverview() — re-derives every metric on time-range change.

function Sparkline({ values, width = 96, height = 26, stroke, fill }) {
  const series = (values ?? []).filter(
    (v) => v !== null && v !== undefined && !Number.isNaN(v),
  );
  if (series.length < 2) {
    return <svg width={width} height={height} className="kpi-spark" aria-hidden="true" />;
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
  const area = d3
    .area()
    .x((_, i) => x(i))
    .y0(height - 2)
    .y1((v) => y(v))
    .curve(d3.curveMonotoneX);
  return (
    <svg width={width} height={height} className="kpi-spark" aria-hidden="true">
      <path d={area(series) ?? ''} fill={fill} />
      <path d={line(series) ?? ''} stroke={stroke} fill="none" strokeWidth="1.4" />
    </svg>
  );
}

function DeltaChip({ value, format }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="delta-chip delta-chip-neutral">·</span>;
  }
  const isPos = value >= 0;
  return (
    <span className={isPos ? 'delta-chip delta-chip-pos' : 'delta-chip delta-chip-neg'}>
      {isPos ? '▲' : '▼'} {format(Math.abs(value))}
    </span>
  );
}

const ACCENT = {
  btc: { stroke: 'var(--accent-btc)', fill: 'rgba(247,147,26,0.18)' },
  pos: { stroke: 'var(--pos)', fill: 'rgba(44,160,44,0.18)' },
  neg: { stroke: 'var(--neg)', fill: 'rgba(214,39,40,0.18)' },
  neutral: { stroke: 'var(--text-1)', fill: 'rgba(170,182,204,0.16)' },
};

function fmtPct(v) {
  return `${(v * 100).toFixed(2)}%`;
}

export function KpiTicker() {
  const { overview, isLoading } = useOverview();

  const btc = overview.btc_daily
    .map((r) => ({ date: r.date, close: Number(r.close), volume: Number(r.volume ?? 0) }))
    .filter((r) => !Number.isNaN(r.close))
    .sort((a, b) => a.date.localeCompare(b.date));

  const closes = btc.map((r) => r.close);
  const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;

  const ret = pctChange(closes);
  const lastReturn = ret.length > 0 ? ret[ret.length - 1] : null;

  const vol30 = rollingStd(ret, 30);
  const lastVolDaily = vol30.length > 0 ? vol30[vol30.length - 1] : null;
  const lastVolAnn = lastVolDaily != null ? lastVolDaily * Math.sqrt(252) : null;

  // 30-day drawdown from rolling 30d high.
  const dd = closes.map((c, i) => {
    const start = Math.max(0, i - 29);
    let peak = -Infinity;
    for (let j = start; j <= i; j += 1) peak = Math.max(peak, closes[j]);
    return peak > 0 ? (c - peak) / peak : null;
  });
  const lastDd = dd.length > 0 ? dd[dd.length - 1] : null;

  // News volume sparkline.
  const news = overview.gdelt_daily_signals
    .map((r) => ({ date: r.date, count: Number(r.news_count ?? 0) }))
    .filter((r) => !Number.isNaN(r.count) && r.count > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const newsCounts = news.map((r) => r.count);
  const lastNews = newsCounts.length > 0 ? newsCounts[newsCounts.length - 1] : 0;

  // BTC vs QQQ rolling 30d correlation.
  const qqqMap = new Map(
    overview.external_assets_daily
      .filter((r) => r.ticker === 'QQQ')
      .map((r) => [r.date, Number(r.close)]),
  );
  const btcCloses = btc.map((r) => r.close);
  const qqqCloses = btc.map((r) => {
    const v = qqqMap.get(r.date);
    return v !== undefined && !Number.isNaN(v) ? v : null;
  });
  const btcRet = pctChange(btcCloses);
  const qqqRet = pctChange(qqqCloses);
  const corr30 = btcCloses.map((_, i) => {
    if (i < 30) return null;
    return pearson(btcRet.slice(i - 29, i + 1), qqqRet.slice(i - 29, i + 1));
  });
  const lastCorr = corr30.length > 0 ? corr30[corr30.length - 1] : null;

  const cards = [
    {
      label: 'BTC Spot',
      value: lastClose != null ? `$${Math.round(lastClose).toLocaleString()}` : '—',
      delta: lastReturn,
      deltaFmt: fmtPct,
      spark: closes.slice(-30),
      accent: 'btc',
    },
    {
      label: '24h Change',
      value: lastReturn != null ? fmtPct(lastReturn) : '—',
      delta: null,
      spark: ret.slice(-7),
      accent: lastReturn != null && lastReturn >= 0 ? 'pos' : 'neg',
    },
    {
      label: '30d Vol (ann.)',
      value: lastVolAnn != null ? `${(lastVolAnn * 100).toFixed(1)}%` : '—',
      delta: null,
      spark: vol30.slice(-60),
      accent: 'neutral',
    },
    {
      label: '30d Drawdown',
      value: lastDd != null ? `${(lastDd * 100).toFixed(1)}%` : '—',
      delta: null,
      spark: dd.slice(-90),
      accent: 'neg',
    },
    {
      label: 'News Vol (1d)',
      value: `${lastNews}`,
      delta: null,
      spark: newsCounts.slice(-14),
      accent: 'neutral',
    },
    {
      label: '30d Corr · QQQ',
      value: lastCorr != null ? lastCorr.toFixed(2) : '—',
      delta: null,
      spark: corr30.slice(-60),
      accent: lastCorr != null && lastCorr >= 0 ? 'pos' : 'neg',
    },
  ];

  return (
    <section className="kpi-ticker" aria-label="Key performance indicators">
      {cards.map((card) => {
        const accent = ACCENT[card.accent] ?? ACCENT.neutral;
        return (
          <div key={card.label} className="kpi-card">
            <span className="kpi-card-label">{card.label}</span>
            <div className="kpi-card-value-row">
              <strong className="kpi-card-value">{isLoading ? '…' : card.value}</strong>
              {card.delta !== null && card.delta !== undefined ? (
                <DeltaChip value={card.delta} format={card.deltaFmt ?? fmtPct} />
              ) : null}
            </div>
            <Sparkline values={card.spark} stroke={accent.stroke} fill={accent.fill} />
          </div>
        );
      })}
    </section>
  );
}
