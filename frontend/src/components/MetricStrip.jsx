function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function MetricStrip({ summary, assets, metadata }) {
  return (
    <div className="metric-strip">
      <article className="metric-card">
        <span>Latest BTC Close</span>
        <strong>{formatCurrency(summary.latest_close)}</strong>
        <small>Coverage: {metadata.start_date} to {metadata.end_date}</small>
      </article>
      <article className="metric-card">
        <span>Period Return</span>
        <strong>{formatPercent(summary.period_return)}</strong>
        <small>Daily move: {formatPercent(summary.latest_daily_return)}</small>
      </article>
      {assets.map((asset) => (
        <article className="metric-card" key={asset.ticker}>
          <span>{asset.ticker}</span>
          <strong>{formatCurrency(asset.latest_close)}</strong>
          <small>Daily move: {formatPercent(asset.latest_daily_return)}</small>
        </article>
      ))}
    </div>
  );
}
