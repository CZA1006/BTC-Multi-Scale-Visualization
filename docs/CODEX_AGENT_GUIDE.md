# Codex Agent Guide for VS Code

Use this document as the initial instruction set when working with Codex inside VS Code.

## Project context to paste into Codex
We are building a web-based visual analytics system for Bitcoin from 2019-01-01 to 2026-04-30. The system has five functional modules: Macro Overview, Meso Pattern View, Meso Feature Explanation, Micro Detail View, and Event Context & Backtracking. Use React + D3.js for the frontend and FastAPI + Python for the backend. Use yfinance for BTC and external assets, GDELT for global narrative signals, and Polymarket for prediction-market context. Store processed data in CSV / JSON / Parquet. Build the system incrementally with clear module boundaries.

## Working rules for Codex
1. Start from the current folder structure and do not reorganize everything unless necessary.
2. Prefer clean, typed, minimal implementations.
3. Generate placeholder data adapters and clear TODO comments where real data will be wired later.
4. For D3 views, prioritize correct scales, labels, and interaction hooks over heavy styling.
5. Every feature should be testable in isolation before being linked.
6. Avoid hidden assumptions about unavailable data columns.
7. When adding dependencies, update the relevant requirements or package files.
8. When unsure, leave a short inline note rather than inventing data behavior.

## First prompts to give Codex
### Prompt 1 — backend scaffold
Create a minimal FastAPI backend with routes for `/api/overview`, `/api/meso`, and `/api/day-detail`. Return mock JSON first, using the schemas described in `docs/SCHEMAS.md`.

### Prompt 2 — yfinance ingestion
Write Python scripts to fetch daily data for BTC-USD, COIN, MSTR, and QQQ from 2019-01-01 to 2026-04-30 using yfinance, then save cleaned outputs to `data/processed/`.

### Prompt 3 — feature engineering
Write a script that reads `btc_daily.csv` and produces `daily_features.csv` with daily_return, oc_change, hl_range, rolling volatility, drawdown, volume_spike_ratio, and prev_day_gap.

### Prompt 4 — frontend shell
Create a React + Vite frontend with routes or sections for Macro, Meso, and Micro, plus a small global store for selectedTimeRange, selectedDate, and selectedCluster.

### Prompt 5 — Macro view
Build a D3-based Macro view with a BTC line chart and a calendar heatmap placeholder, wired to mock data first.

### Prompt 6 — Meso view
Build a D3 scatterplot for embedding results and a parallel coordinates component for selected clusters.

### Prompt 7 — Micro view
Build a selected-day detail chart and a side panel for top headlines and event context.
