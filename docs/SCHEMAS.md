# Data Schemas

## btc_daily.csv
| column | type | description |
|---|---|---|
| date | date | trading day |
| open | float | opening price |
| high | float | daily high |
| low | float | daily low |
| close | float | closing price |
| volume | float | traded volume |
| daily_return | float | close-to-close return |
| oc_change | float | open-close percentage change |
| hl_range | float | (high-low)/open |
| rolling_vol_7d | float | 7-day realized volatility |
| drawdown | float | drawdown from rolling peak |

## btc_intraday.csv
| column | type | description |
|---|---|---|
| timestamp | datetime | market timestamp |
| open | float | opening price |
| high | float | high |
| low | float | low |
| close | float | close |
| volume | float | interval volume |
| trade_date | date | derived selected day key |

## external_assets_daily.csv
| column | type | description |
|---|---|---|
| date | date | trading day |
| ticker | string | COIN / MSTR / QQQ |
| close | float | closing price |
| daily_return | float | daily return |
| volume | float | daily volume |

## gdelt_daily_signals.csv  *(P9 schema)*
Rolled up from `data/raw/gdelt_selected_day/<YYYY-MM-DD>.json` by
`fetch_gdelt_historical.py` (auto at end of every fetch + `--rebuild-signals`).

| column | type | description |
|---|---|---|
| date | date | day |
| news_count | int | count of filtered relevant articles |
| avg_tone | float | average GDELT tone (RawTone) |
| theme_count_crypto | int | count of crypto-related themes |
| theme_count_regulation | int | count of regulatory themes |
| theme_count_election | int | count of election themes |
| theme_count_war | int | count of war/geopolitical themes |
| theme_count_macro | int | count of macro/Fed/inflation themes (P9) |
| theme_count_covid | int | count of covid/pandemic themes (P9) |
| bucket | string | curated case-study bucket key (P9): `covid_shock` / `war_regime` / `election_cycle` / `iran_tension` / null (generic fallback) |
| bucket_label | string | human-readable bucket label, e.g. `"US Election Cycle (2024)"` (P9) |
| top_headlines | string | JSON-encoded top headlines list |
| status | string | `live` / `cached` / `fetch_error` / `unavailable_*` |
| message | string | fetch or cache status message |

## events_selected_day.csv
| column | type | description |
|---|---|---|
| timestamp | datetime | event time |
| source | string | article source |
| headline | string | top headline |
| category | string | topic category |
| sentiment | float | optional sentiment score |
| url | string | article link |

## polymarket_daily.csv  *(legacy "today" snapshot — kept for reference only)*
| column | type | description |
|---|---|---|
| date | date | day |
| market_slug | string | market identifier |
| market_name | string | readable market name |
| probability | float | daily probability / price |
| volume | float | optional daily volume |
| theme | string | theme bucket for the selected market |
| source_query | string | search query used to retrieve the market |
| status | string | live / cached / fetch_error |

## polymarket_history_daily.csv  *(P8 — canonical historical table)*
Long-format daily YES-token price history per curated market. Produced
by `fetch_polymarket_history.py` from CLOB `/prices-history` calls.
~6,700 rows across ~70 curated markets.

| column | type | description |
|---|---|---|
| bucket | string | case-study bucket key: `election_cycle` / `iran_tension` (etc.) |
| event_slug | string | Polymarket Gamma event slug (e.g. `presidential-election-winner-2024`) |
| market_slug | string | Polymarket market slug |
| market_name | string | human-readable market question |
| theme | string | inferred theme tag (election / iran / crypto / fed / …) |
| ts | int | UNIX seconds for the price observation |
| date | date | UTC calendar date of `ts` |
| yes_price | float | YES-token price ∈ [0, 1] (probability) |

## daily_features.csv
| column | type | description |
|---|---|---|
| date | date | trading day |
| daily_return | float | BTC daily return |
| oc_change | float | open-close change |
| hl_range | float | high-low range |
| realized_vol | float | intraday or rolling volatility |
| max_drawdown | float | maximum intraday or daily drawdown |
| volume_spike_ratio | float | volume anomaly ratio |
| prev_day_gap | float | open vs previous close |
| qqq_corr_rolling | float | optional rolling relation with QQQ |
| gdelt_news_count | float | optional GDELT signal |
| gdelt_avg_tone | float | optional GDELT signal |
| polymarket_prob_change | float | optional prediction signal |

## embedding_results.csv
| column | type | description |
|---|---|---|
| date | date | trading day |
| x | float | embedding x |
| y | float | embedding y |
| cluster_id | int | assigned cluster |
| abnormal_score | float | optional anomaly score |
