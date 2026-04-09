# BTC Multi-Scale Visualization

## Project overview
This project is a web-based Bitcoin visual analytics system for `2019-01-01` to `2026-04-30`.

Current implemented scope:
- yfinance ingestion for BTC and external assets
- BTC daily features and 2D embedding / clustering
- FastAPI endpoints for overview, meso, and selected-day detail
- React dashboard with linked Macro / Meso / Micro views
- GDELT selected-day headlines and recent daily signal overlay
- Polymarket minimal market-expectation snapshot in Micro context

## Folder structure
```text
backend/
  app/
    main.py
    routes/
  scripts/
  requirements.txt
frontend/
  src/
    api/
    store/
    views/
  package.json
data/
  raw/
  processed/
  derived/
docs/
notebooks/
```

## Backend setup
Recommended local environment:
- Python `3.11`
- `conda` is recommended on macOS

From the repo root:

```bash
conda create -n btcviz python=3.11 -y
conda activate btcviz
pip install -r backend/requirements.txt
```

## Frontend setup
From the repo root:

```bash
cd frontend
npm install
cd ..
```

## Data fetching steps
Fetch market data for:
- `BTC-USD`
- `COIN`
- `MSTR`
- `QQQ`

Run:

```bash
python3 backend/scripts/fetch_market_data.py
```

This creates:
- `data/processed/btc_daily.csv`
- `data/processed/btc_intraday.csv`
- `data/processed/external_assets_daily.csv`

## Feature generation steps
Build BTC daily features:

```bash
python3 backend/scripts/build_daily_features.py
```

This creates:
- `data/derived/daily_features.csv`

Build the embedding and placeholder clusters:

```bash
python3 backend/scripts/build_embedding.py
```

This creates:
- `data/derived/embedding_results.csv`

## GDELT and Polymarket context
Fetch recent GDELT selected-day context and build recent daily signals:

```bash
python3 backend/scripts/fetch_gdelt_context.py
```

This creates:
- `data/raw/gdelt_selected_day/*.json`
- `data/derived/gdelt_daily_signals.csv`

Fetch the current minimal Polymarket context snapshot:

```bash
python3 backend/scripts/fetch_polymarket_context.py
```

This creates:
- `data/raw/polymarket_selected_day/*.json`
- `data/derived/polymarket_daily.csv`

Notes:
- The current GDELT script is limited to the recent DOC API lookback window.
- The current Polymarket integration is a minimal live snapshot, not a full historical backfill.

## How to run the app locally
Start the backend:

```bash
conda activate btcviz
uvicorn backend.app.main:app --reload
```

Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Then open the local Vite URL, usually:

```text
http://127.0.0.1:5173
```

The backend API usually runs at:

```text
http://127.0.0.1:8000
```

## Current workflow
1. Install backend and frontend dependencies.
2. Run `fetch_market_data.py`.
3. Run `build_daily_features.py`.
4. Run `build_embedding.py`.
5. Optionally run `fetch_gdelt_context.py`.
6. Optionally run `fetch_polymarket_context.py`.
7. Start FastAPI.
8. Start the React app.

## Current frontend status
- Macro: BTC timeline, time brush, calendar heatmap, GDELT event markers
- Meso: embedding scatterplot, cluster selector, parallel coordinates
- Micro: selected-day intraday or fallback window chart, GDELT headline panel, Polymarket context

## Current limitations
- GDELT history is not backfilled for the full 2019-2026 range yet
- Polymarket is currently a minimal current snapshot, not a full historical overlay
- Macro event overlays are intentionally lightweight and presentation-focused

## Useful docs
- [AGENTS.md](AGENTS.md)
- [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)
- [docs/DATA_AND_APIS.md](docs/DATA_AND_APIS.md)
- [docs/SCHEMAS.md](docs/SCHEMAS.md)
- [docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md)
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
