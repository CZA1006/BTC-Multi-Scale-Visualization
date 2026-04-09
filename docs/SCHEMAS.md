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

## gdelt_daily_signals.csv
| column | type | description |
|---|---|---|
| date | date | day |
| news_count | int | count of filtered relevant articles |
| avg_tone | float | average GDELT tone |
| theme_count_crypto | int | count of crypto-related themes |
| theme_count_regulation | int | count of regulatory themes |
| theme_count_election | int | count of election themes |
| theme_count_war | int | count of war/geopolitical themes |
| top_headlines | string | JSON-encoded top headlines list |
| status | string | live / cached / fetch_error / unavailable_* |
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

## polymarket_daily.csv
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
