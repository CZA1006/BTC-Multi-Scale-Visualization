function buildPath(points, width, height, padding) {
  if (points.length === 0) {
    return '';
  }

  const closes = points.map((point) => point.close);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const xSpan = Math.max(points.length - 1, 1);
  const ySpan = Math.max(maxClose - minClose, 1);

  return points
    .map((point, index) => {
      const x = padding + (index / xSpan) * (width - padding * 2);
      const y =
        height -
        padding -
        ((point.close - minClose) / ySpan) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildAreaPath(points, width, height, padding) {
  const linePath = buildPath(points, width, height, padding);
  if (!linePath) {
    return '';
  }

  const firstX = padding;
  const lastX = padding + (width - padding * 2);
  const baseline = height - padding;
  return `${linePath} L ${lastX.toFixed(1)} ${baseline.toFixed(1)} L ${firstX.toFixed(1)} ${baseline.toFixed(1)} Z`;
}

export function TimelineChart({ series }) {
  const width = 960;
  const height = 320;
  const padding = 26;
  const path = buildPath(series, width, height, padding);
  const areaPath = buildAreaPath(series, width, height, padding);
  const latest = series.at(-1);

  return (
    <div className="timeline-shell">
      <svg viewBox={`0 0 ${width} ${height}`} className="timeline-svg" role="img" aria-label="BTC price timeline">
        <defs>
          <linearGradient id="timelineFill" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 176, 92, 0.38)" />
            <stop offset="100%" stopColor="rgba(255, 176, 92, 0)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="24" className="timeline-bg" />
        <path d={areaPath} fill="url(#timelineFill)" opacity="0.8" />
        <path d={path} className="timeline-line" />
      </svg>
      <div className="timeline-footer">
        <div>
          <span>Macro timeline</span>
          <strong>{series[0]?.date}</strong>
        </div>
        <div>
          <span>Latest point</span>
          <strong>{latest?.date}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>Brush interaction next</strong>
        </div>
      </div>
    </div>
  );
}
