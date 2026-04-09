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

## 2. GDELT
### Source
- Homepage: https://www.gdeltproject.org/
- Data page: https://www.gdeltproject.org/data.html

### Recommendation
Use **GDELT GKG / daily aggregated exports or BigQuery queries**, not full raw yearly downloads.

### Why
- GDELT GKG is better for narrative context, themes, and tone
- A full year of GKG is huge, so start with filtered and aggregated subsets

### Fields to derive
- `date`
- `news_count`
- `avg_tone`
- `theme_count_crypto`
- `theme_count_regulation`
- `theme_count_election`
- `theme_count_war`
- `top_headlines`

### Suggested themes / keywords
- BITCOIN
- CRYPTO
- BLOCKCHAIN
- ETF
- SEC
- REGULATORY
- CENTRALBANK / FED
- TRUMP / ELECTION
- IRAN / WAR / UKRAINE

### Output tables
- `gdelt_daily_signals.csv`
- `gdelt_selected_day.csv`
- `events_selected_day.csv`

## 3. Polymarket
### Source
- API intro: https://docs.polymarket.com/api-reference/introduction
- Prices history: https://docs.polymarket.com/api-reference/markets/get-prices-history

### What to use
- A small number of relevant markets only
- U.S. election related markets
- ETF / crypto regulation markets
- Optional Middle East geopolitical markets if relevant and available

### Output tables
- `polymarket_daily.csv`
- `polymarket_selected_day.csv`

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
