# Data layout

This directory holds **local, file-based** inputs for the dashboard. What is committed here is a **frozen canonical snapshot** so reviewers can run the stack without re-fetching markets or APIs.

## Subfolders

| Path | Role |
|------|------|
| `processed/` | Cleaned daily / intraday market tables (yfinance and friends). |
| `derived/` | Feature engineering, embeddings, and rolled-up event signals used by Meso / API. |
| `raw/gdelt_selected_day/` | Cached GDELT DOC API JSON, one file per day across all 4 case-study windows (P9). |
| `raw/polymarket_events/` | Cached Polymarket Gamma `/events` payloads, one per curated event slug (P8). |
| `raw/polymarket_history/` | Cached CLOB `/prices-history` payloads, one per market YES-token (P8). |
| `raw/polymarket_selected_day/` | *Legacy* per-day Polymarket "today" snapshots. No longer used by the dashboard; kept for reproducibility of pre-P8 demos. |

## Regeneration

From repo root, with your Python env and dependencies installed:

- **Market tables:** `backend/scripts/fetch_market_data.py`
- **Daily features / embeddings:** `backend/scripts/build_daily_features.py`, `backend/scripts/build_embedding.py`
- **GDELT — recent rolling window:** `backend/scripts/fetch_gdelt_context.py`
- **GDELT — historical case-study coverage (P9):** `backend/scripts/fetch_gdelt_historical.py [--full | --rebuild-signals]`
- **Polymarket — historical event series (P8):** `backend/scripts/fetch_polymarket_history.py`
- **Polymarket — legacy "today" snapshot:** `backend/scripts/fetch_polymarket_context.py`

Schema and field notes live in `docs/DATA_AND_APIS.md` and `docs/SCHEMAS.md`.

## What we do **not** commit

- `**/*.parquet` under `data/` (reserved for larger extracts; use scripts or release artifacts instead).
- Scratch paths `data/_scratch/`, `data/tmp/` if you create them locally.
