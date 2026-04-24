# Data layout

This directory holds **local, file-based** inputs for the dashboard. What is committed here is a **frozen canonical snapshot** so reviewers can run the stack without re-fetching markets or APIs.

## Subfolders

| Path | Role |
|------|------|
| `processed/` | Cleaned daily / intraday market tables (yfinance and friends). |
| `derived/` | Feature engineering and embedding outputs used by Meso / API. |
| `raw/gdelt_selected_day/` | Cached GDELT DOC API JSON for selected demo dates. |
| `raw/polymarket_selected_day/` | Cached Polymarket JSON for selected demo dates. |

## Regeneration

From repo root, with your Python env and dependencies installed:

- Market tables: `backend/scripts/fetch_market_data.py`
- Daily features / embeddings: `backend/scripts/build_daily_features.py`, `backend/scripts/build_embedding.py`
- GDELT context: `backend/scripts/fetch_gdelt_context.py`
- Polymarket context: `backend/scripts/fetch_polymarket_context.py`

Schema and field notes live in `docs/DATA_AND_APIS.md` and `docs/SCHEMAS.md`.

## What we do **not** commit

- `**/*.parquet` under `data/` (reserved for larger extracts; use scripts or release artifacts instead).
- Scratch paths `data/_scratch/`, `data/tmp/` if you create them locally.
