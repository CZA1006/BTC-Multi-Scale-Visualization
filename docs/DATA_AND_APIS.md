# Data and APIs

## Final source decision
We will use:
- **yfinance** for BTC and external market data
- **GDELT** for global event / narrative signals
- **Polymarket API** for market-expectation time series
- **Optional CoinGecko fallback** only if BTC-specific market fields are needed beyond yfinance

## 1. BTC and external assets
### Source
- yfinance PyPI: https://pypi.org/project/yfinance/
- yfinance docs: https://ranaroussi.github.io/yfinance/index.html

### Tickers
- BTC-USD
- COIN
- MSTR
- QQQ
- Optional: GLD

### Why use it
- Fast access to daily market data
- Simple Python integration
- Good enough for course-project scale

### What to pull
#### Daily
- Open, High, Low, Close, Volume
#### Intraday
- For BTC-USD selected-day or rolling windows, subject to provider limits in yfinance interval history

### Output tables
- `btc_daily.csv`
- `btc_intraday.csv`
- `external_assets_daily.csv`
- `external_assets_selected_day.csv`

## 2. GDELT — date-aware historical (P9)

### Source
- Homepage: https://www.gdeltproject.org/
- DOC API: https://api.gdeltproject.org/api/v2/doc/doc

### Why this design
The legacy implementation paired a single bitcoin-only `DEFAULT_QUERY`
with a 90-day lookback guard. Two problems:

1. **Lookback** — the 90-day guard was overly conservative. The DOC API
   actually returns useful headlines for 2020-03-12 (Black Thursday),
   2022-02-24 (Russia invades Ukraine), and 2024-11-05 (election day).
   The guard was the limiter, not the API.
2. **Topical breadth** — querying `bitcoin OR crypto OR …` on a war or
   election day produced near-empty headline panels and a crypto-only
   word cloud. The chart "worked" but said nothing.

P9 replaces both with a **per-window curated DOC query** that pivots
the keyword set to the dominant narrative of that window, plus a
broadened generic fallback for dates outside any case study. The
lookback is now 8 years.

### Curated queries
See `backend/app/services/gdelt_curated.py`.

| Bucket | Window | DOC query (excerpt) |
|---|---|---|
| `covid_shock` | 2020-02-01 → 2020-06-30 | `(covid OR coronavirus OR pandemic OR "black thursday" OR fed OR "interest rate" OR stimulus OR "stock market" OR crash OR bitcoin OR crypto)` |
| `war_regime` | 2022-02-01 → 2022-05-31 | `(ukraine OR russia OR putin OR invasion OR war OR sanctions OR swift OR "oil price" OR bitcoin OR crypto OR ruble)` |
| `election_cycle` | 2024-09-01 → 2025-01-31 | `(trump OR harris OR election OR vote OR campaign OR debate OR "white house" OR bitcoin OR "spot etf" OR crypto OR fed)` |
| `iran_tension` | 2026-03-01 → 2026-04-30 | `(iran OR israel OR "middle east" OR strike OR "nuclear deal" OR uranium OR tehran OR netanyahu OR "oil price" OR bitcoin OR crypto OR fed)` |
| *generic fallback* | (anywhere else) | `(bitcoin OR btc OR crypto OR "spot etf" OR fed OR inflation OR "interest rate" OR "stock market" OR election OR war OR "oil price")` |

Every curated query keeps `bitcoin OR crypto` as a tail clause so the
asset chart always has something tying back to BTC even on days
dominated by non-financial news.

### Theme inference (6 categories)
`gdelt_service.py::CATEGORY_KEYWORDS` is now ordered:
`war → election → covid → regulation → macro → crypto → general`. War
comes first deliberately so an Iran headline outside the iran_tension
window still tags as `war` rather than `crypto` because the article
happens to mention bitcoin in a sidebar.

The response payload exposes both the legacy four counts
(`theme_count_crypto`, `theme_count_regulation`, `theme_count_election`,
`theme_count_war`) and two new ones (`theme_count_macro`,
`theme_count_covid`) plus `bucket`, `bucket_label`, and `query` for
provenance.

### Hot-dates seed cache
`backend/scripts/fetch_gdelt_historical.py` warms the cache for 32
hand-picked hot dates across the four windows — Black Thursday, Fed
emergency cuts, CARES Act, Russia invasion + SWIFT cut, Harris-Trump
debate, election day, BTC $100k, Trump inauguration, Iran spikes.

```bash
python3 backend/scripts/fetch_gdelt_historical.py            # hot dates only (~32 calls)
python3 backend/scripts/fetch_gdelt_historical.py --full      # every day in every window (~480 calls)
python3 backend/scripts/fetch_gdelt_historical.py --refresh   # ignore existing cache
```

### Caching
- `data/raw/gdelt_selected_day/<YYYY-MM-DD>.json` — one file per day,
  written on first fetch and re-served on every subsequent request.
- `data/raw/gdelt_daily_signals.csv` — separate (legacy) recent-window
  rolling table, untouched by P9.

### Output payload (selected-day)
```jsonc
{
  "date": "2024-11-05",
  "status": "live",                              // or "cached"
  "bucket": "election_cycle",
  "bucket_label": "US Election Cycle (2024)",
  "query": "(trump OR harris OR …)",
  "news_count": 15,
  "avg_tone": -1.42,
  "theme_count_election": 9,
  "theme_count_macro": 2,
  "theme_count_war": 1,
  "theme_count_crypto": 2,
  "theme_count_covid": 0,
  "theme_count_regulation": 1,
  "hourly_tones": [{"timestamp": "...", "news_count": 3, "average_tone": -2.1}, …],
  "top_headlines": ["…"],
  "articles": [{"timestamp": "...", "source": "...", "headline": "...", "category": "election", "sentiment": -2.1, "url": "..."}, …]
}
```

### Limitations
- DOC API rate-limits at roughly one request per second; the bulk
  script defaults to a 0.7s sleep.
- Theme inference is keyword-based and order-sensitive; it's good
  enough for headline tagging but not for academic content analysis.
- Full-archive (GKG raw 15-min files) is still out of scope — the DOC
  API gives us titled, deduped articles, which is what the headline
  panel needs.

## 3. Polymarket — date-aware historical (P8)

### Sources
- Gamma Events API — `https://gamma-api.polymarket.com/events?slug=<slug>&limit=1`
  returns the event metadata + every market with `clobTokenIds`,
  `conditionId`, `startDate`, `endDate`, `outcomes`, `outcomePrices`,
  `volume`.
- CLOB Prices-History API — `https://clob.polymarket.com/prices-history?market=<token>&interval=max&fidelity=1440`
  returns the **full daily price history** for a YES/NO token as
  `{history: [{t, p}, …]}`.
- Docs: https://docs.polymarket.com/developers/CLOB/timeseries

### Why this design
The original implementation used `gamma-api.polymarket.com/public-search`
with `events_status=active`, which returns *today's* markets keyed on a
keyword query — useless when the user picks a date in 2024 or 2026-03.
P8 replaces it with a **curated event-slug map per case-study window**,
plus a generic fetcher for the historical CLOB price series.

The keyword search is too recency-biased to discover historical markets,
so the map is curated by hand once. Every other piece of the pipeline is
generic.

### Curated buckets
See `backend/app/services/polymarket_curated.py`. Current coverage:

| Bucket | Window | Curated events |
|---|---|---|
| `covid_shock` | 2020-02-01 → 2020-06-30 | *(empty — Polymarket coverage was effectively absent that early)* |
| `war_regime` | 2022-02-01 → 2022-05-31 | *(empty — markets existed but were illiquid)* |
| `election_cycle` | 2024-09-01 → 2025-01-31 | `presidential-election-winner-2024`, `bitcoin-new-all-time-high-in-2024`, `bitcoin-all-time-high-in-2024`, `bitcoin-price-1hr-after-etf-approval` |
| `iran_tension` | 2026-03-01 → 2026-04-30 | `us-iran-nuclear-deal-by-april-30/june-30`, `iran-military-action-against-by-april-30`, `will-trump-declare-war-on-iran-by`, `will-the-us-officially-declare-war-on-iran-by`, `fed-decision-in-april` |

For dates inside an empty bucket the API returns `status: "unavailable"`
with a friendly message — the UI shows "no Polymarket coverage for this
period."

### Filtering & ranking
For the selected date, a market is included when:

1. its `startDate ≤ target` (it had begun trading by the user's date),
2. its `endDate` is no more than **14 days** before `target` (so a
   market that resolved the day before still surfaces with its closing
   probability — relevant for the day-after-election narrative).

After the lifespan filter, markets with `volume < 1 000 USDC` are
dropped (illiquid noise) and the top **8 by 24h volume** are returned.
This keeps the UI legible — the Iran bucket has 41 raw markets and
mostly $0 volume.

### Caching
- `data/raw/polymarket_events/<slug>.json` — full Gamma event payload,
  one file per curated slug.
- `data/raw/polymarket_history/<token>.json` — full daily price history
  for a YES token, refreshed via `--refresh`.
- `data/derived/polymarket_history_daily.csv` — long-format table
  (bucket, event_slug, market_slug, question, theme, ts, date, yes_price)
  for offline analysis. Currently ~6 600 rows across 70 markets.

### Refresh recipe
```bash
python3 backend/scripts/fetch_polymarket_history.py --refresh
```

### Schema returned to the frontend
```jsonc
{
  "as_of_date": "2024-11-05",
  "status": "historical",                      // | "unavailable"
  "bucket": "election_cycle",
  "bucket_label": "US Election Cycle (2024)",
  "message": "Showing 8 curated Polymarket markets…",
  "markets": [
    {
      "market_slug": "will-donald-trump-win-…",
      "market_name": "Will Donald Trump win the 2024 US Presidential Election?",
      "event_title": "Presidential Election Winner 2024",
      "theme": "election",
      "yes_label": "Yes",  "no_label": "No",
      "yes_token_id": "21742633…",
      "yes_price_at_date": 0.5635,             // closest data point ≤ target
      "yes_price_observed_at": "2024-11-04T00:00:03+00:00",
      "current_yes_price": 1.0,                // resolution / latest
      "volume": 1531479284.50,
      "start_date": "2024-01-04T22:58Z",
      "end_date":   "2024-11-05T12:00Z",
      "closed": true,
      "history": [{"t": 1704412803, "p": 0.5}, … 307 points …]
    }
  ]
}
```

### Limitations
- The CLOB endpoint only reliably returns ≥12-hour granularity for
  *resolved* markets ([py-clob-client #216](https://github.com/Polymarket/py-clob-client/issues/216))
  — we use `fidelity=1440` (1 day) which is well within that.
- COVID 2020 + Russia 2022 windows have **no** Polymarket coverage
  worth showing; the UI degrades gracefully.
- New case-study windows require a one-time curation pass (find slugs
  via `gamma-api.polymarket.com/public-search`, paste into
  `polymarket_curated.py`, run the fetch script).

### Output tables (legacy + new)
- `polymarket_daily.csv` — *legacy "today" snapshot* (still produced by
  `fetch_polymarket_context.py` for reference; no longer used by the
  day-detail route).
- `polymarket_history_daily.csv` — **canonical historical table**
  (P8, used by the dashboard).

## 4. Final dataset mapping by layer
### Macro Overview
- `btc_daily.csv`
- `external_assets_daily.csv`
- `gdelt_daily_signals.csv`
- `polymarket_daily.csv` (case-window focused)

### Meso Pattern View
- `daily_features.csv`
- `embedding_results.csv`
- `cluster_labels.csv`
- optional GDELT / Polymarket derived daily features

### Micro Detail View
- `btc_intraday.csv`
- `events_selected_day.csv`
- `gdelt_selected_day.csv`
- `external_assets_selected_day.csv`
- `polymarket_selected_day.csv`
