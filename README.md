# BTC Multi-Scale Visualization

## Project overview
This project is a web-based Bitcoin visual analytics system for `2019-01-01` to `2026-04-30`.
The round-1 goal is to build a working full-stack scaffold with:
- yfinance market data ingestion
- BTC daily feature generation
- 2D embedding generation for the meso view
- a minimal FastAPI backend
- a React frontend with Macro, Meso, and Micro placeholder sections

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
From the repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate
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
Round 1 uses `yfinance` only.

Fetch daily market data for:
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
- `data/processed/external_assets_daily.csv`

## Feature generation steps
Build BTC daily features:

```bash
python3 backend/scripts/build_daily_features.py
```

This creates:
- `data/derived/daily_features.csv`

Build the round-1 embedding and placeholder clusters:

```bash
python3 backend/scripts/build_embedding.py
```

This creates:
- `data/derived/embedding_results.csv`

## How to run the app locally
Start the backend:

```bash
source .venv/bin/activate
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

The backend API will usually run at:

```text
http://127.0.0.1:8000
```

## Round-1 workflow
1. Install backend and frontend dependencies.
2. Run `fetch_market_data.py`.
3. Run `build_daily_features.py`.
4. Run `build_embedding.py`.
5. Start FastAPI.
6. Start the React app.

## Useful docs
- [AGENTS.md](AGENTS.md)
- [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)
- [docs/DATA_AND_APIS.md](docs/DATA_AND_APIS.md)
- [docs/SCHEMAS.md](docs/SCHEMAS.md)
- [docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md)
