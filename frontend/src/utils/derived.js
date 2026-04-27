// Pure derived-attribute helpers for Macro/Micro views.
// Avoid pulling in React; keep d3 usage out of this module so it stays unit-testable.

export function pctChange(values) {
  const out = new Array(values.length).fill(null);
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const curr = values[i];
    if (prev === null || prev === undefined || curr === null || curr === undefined || prev === 0) {
      out[i] = null;
      continue;
    }
    out[i] = (curr - prev) / prev;
  }
  return out;
}

export function rollingMean(values, window) {
  const out = new Array(values.length).fill(null);
  if (window <= 0) return out;
  let sum = 0;
  let count = 0;
  const queue = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v !== null && v !== undefined && !Number.isNaN(v)) {
      queue.push(v);
      sum += v;
      count += 1;
    } else {
      queue.push(null);
    }
    if (queue.length > window) {
      const removed = queue.shift();
      if (removed !== null) {
        sum -= removed;
        count -= 1;
      }
    }
    out[i] = count > 0 ? sum / count : null;
  }
  return out;
}

export function rollingStd(values, window) {
  const out = new Array(values.length).fill(null);
  if (window <= 1) return out;
  const queue = [];
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    queue.push(v);
    if (v !== null && v !== undefined && !Number.isNaN(v)) {
      sum += v;
      sumSq += v * v;
      count += 1;
    }
    if (queue.length > window) {
      const removed = queue.shift();
      if (removed !== null && removed !== undefined && !Number.isNaN(removed)) {
        sum -= removed;
        sumSq -= removed * removed;
        count -= 1;
      }
    }
    if (count > 1) {
      const mean = sum / count;
      const variance = Math.max(0, sumSq / count - mean * mean);
      out[i] = Math.sqrt(variance);
    } else {
      out[i] = null;
    }
  }
  return out;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'over', 'after',
  'about', 'amid', 'says', 'said', 'will', 'would', 'could', 'has', 'have', 'had',
  'are', 'was', 'were', 'been', 'being', 'its', 'their', 'they', 'them', 'his',
  'her', 'who', 'what', 'when', 'where', 'why', 'how', 'all', 'any', 'one',
  'two', 'new', 'now', 'top', 'see', 'big', 'btc', 'usd', 'inc', 'ltd',
]);

export function tokenizeHeadlines(events) {
  const freq = new Map();
  const toneAcc = new Map();
  const toneN = new Map();
  for (const ev of events ?? []) {
    const text = String(ev.headline ?? '').toLowerCase();
    if (!text) continue;
    const words = text.match(/[a-z]{3,}/g) ?? [];
    const tone = Number(
      ev.average_tone ?? ev.avg_tone ?? ev.v2_rawtone ?? ev.tone ?? NaN,
    );
    const seen = new Set();
    for (const word of words) {
      if (STOPWORDS.has(word)) continue;
      if (seen.has(word)) continue;
      seen.add(word);
      freq.set(word, (freq.get(word) ?? 0) + 1);
      if (!Number.isNaN(tone)) {
        toneAcc.set(word, (toneAcc.get(word) ?? 0) + tone);
        toneN.set(word, (toneN.get(word) ?? 0) + 1);
      }
    }
  }
  return Array.from(freq.entries())
    .map(([word, count]) => ({
      word,
      count,
      meanTone: toneN.get(word) ? toneAcc.get(word) / toneN.get(word) : null,
    }))
    .sort((a, b) => b.count - a.count);
}

// Order mirrors backend `gdelt_service.CATEGORY_KEYWORDS` (war first so
// Iran-mentioning crypto sidebars still tag as war, crypto last so an
// unrelated bitcoin mention doesn't swamp a covid/macro day).
const THEME_PATTERNS = [
  { theme: 'war',        regex: /\bwar\b|attack|strike|military|missile|conflict|invasion|israel|iran|ukraine|russia|putin|tehran|nuclear/i },
  { theme: 'election',   regex: /election|campaign|vote|debate|senate|congress|white house|swing state|trump|harris|biden/i },
  { theme: 'covid',      regex: /covid|coronavirus|pandemic|lockdown|vaccine|black thursday/i },
  { theme: 'regulation', regex: /\bsec\b|cftc|regulat|tariff|policy|tax|sanction|swift|lawsuit|\bban\b/i },
  { theme: 'macro',      regex: /\bfed\b|federal reserve|inflation|\brate\b|\brates\b|\bcpi\b|powell|stimulus|\bqe\b/i },
  { theme: 'crypto',     regex: /bitcoin|btc|crypto|etf|halving|on.?chain|mining|wallet|coinbase|microstrategy/i },
];

export const THEME_LIST = ['war', 'election', 'covid', 'regulation', 'macro', 'crypto', 'other'];

export function classifyTheme(text, backendCategory) {
  // Prefer the backend's per-article `category` when present — it uses
  // the same category set and already saw the URL too. Fall back to a
  // headline-only regex sweep otherwise.
  if (backendCategory && THEME_LIST.includes(backendCategory)) {
    return backendCategory;
  }
  const s = String(text ?? '');
  for (const { theme, regex } of THEME_PATTERNS) {
    if (regex.test(s)) return theme;
  }
  return 'other';
}

// Pearson correlation over two equal-length numeric arrays.
// Skips index pairs where either side is null/undefined/NaN. Returns null if
// fewer than 2 valid pairs survive or either side has zero variance.
export function pearson(a, b) {
  const n = Math.min(a?.length ?? 0, b?.length ?? 0);
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x === null ||
      x === undefined ||
      Number.isNaN(x) ||
      y === null ||
      y === undefined ||
      Number.isNaN(y)
    ) {
      continue;
    }
    sa += x;
    sb += y;
    saa += x * x;
    sbb += y * y;
    sab += x * y;
    count += 1;
  }
  if (count < 2) return null;
  const mx = sa / count;
  const my = sb / count;
  const cov = sab / count - mx * my;
  const vx = saa / count - mx * mx;
  const vy = sbb / count - my * my;
  if (vx <= 0 || vy <= 0) return null;
  return cov / Math.sqrt(vx * vy);
}

// Cumulative return index — base 1, multiplies (1 + r) for each return.
// Nulls treated as 0 (no movement that day). Useful for cluster equity-curve
// sparklines where only the shape matters.
export function cumulativeReturnIndex(returns) {
  let v = 1;
  return (returns ?? []).map((r) => {
    if (r !== null && r !== undefined && !Number.isNaN(r)) {
      v *= 1 + r;
    }
    return v;
  });
}

export function bucketHeadlinesByThemeHour(events) {
  // Returns array of { hour: 0..23, war, election, covid, regulation, macro, crypto, other }.
  const buckets = Array.from({ length: 24 }, (_, hour) => {
    const row = { hour };
    for (const k of THEME_LIST) row[k] = 0;
    return row;
  });
  for (const ev of events ?? []) {
    const ts = String(ev.timestamp ?? '');
    const m = ts.match(/[T ](\d{2})/);
    if (!m) continue;
    const hour = Number(m[1]);
    if (hour < 0 || hour > 23) continue;
    const theme = classifyTheme(ev.headline, ev.category);
    buckets[hour][theme] += 1;
  }
  return buckets;
}
