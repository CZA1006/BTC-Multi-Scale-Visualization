# BTC Multi-Scale Visualization

A coordinated multi-view visual analytics dashboard for Bitcoin that links a
**Macro** (multi-year), **Meso** (daily market states), and **Micro**
(single-day with event context) workflow into one Bloomberg-terminal-styled
interface.

> **Course:** HKUST MSBD5005 · Data Visualization (Spring 2026)
> **Time range covered:** 2019-01-01 → 2026-04-30
> **Stack:** FastAPI · Pandas · React 18 · Vite · D3 v7 · ECharts v6 · Zustand

---

## Highlights

- **Three coordinated scales** with a shared selection model (`time range`,
  `selected day`, `selected cluster`) so brushing in Macro filters Meso, and
  clicking in Meso drills Micro.
- **Bloomberg-inspired information density** — KPI ticker with inline
  sparklines, hairline grids, tabular numerics, ▲/▼ delta chips,
  small-multiples cluster summary table, 4×4 cross-asset correlation matrix.
- **Western color convention** end-to-end (`green = up`, `red = down`) —
  candlesticks, heatmap, horizon graph, KPI deltas all aligned.
- **Martini-glass narrative shell** — four authored case-study narratives
  (COVID Shock, War Regime, Election Cycle, Iran Tension) play step-by-step
  with a spotlight ring on the relevant view, then release into free
  exploration.
- **In-app insight log** — pin observations from any view with full context,
  restore a pinned moment, export the cohort as JSON.
- **Modern viz toolkit** — UMAP scatter with cluster hulls + density splat,
  Inselberg parallel coordinates with axis reordering + brushing, SPLOM with
  KDE diagonals, mirror-folded horizon graph, ThemeRiver, d3-cloud word
  cloud, ECharts 3-grid candlestick + volume + GDELT bars.
- **Offline-by-default** — a canonical CSV/JSON snapshot ships in `data/`
  so the demo runs without any external API call.

---

## Screenshot tour

```
┌──────────────────────────────────────────────────────────────────────┐
│  Title bar · Case-Study Navigator · KPI Ticker · Status strip        │
├──────────────────────────────────────────────────────────────────────┤
│  Macro:   horizon graph │ BTC long-term timeline │ calendar heatmap  │
├──────────────────────────────────────────────────────────────────────┤
│  Meso:    UMAP scatter │ regime summary table │ correlation matrix  │
│           tab: parallel coords  /  SPLOM (top-4)                     │
├──────────────────────────────────────────────────────────────────────┤
│  Micro:   3-grid candle/volume/GDELT │ word cloud │ theme river     │
└──────────────────────────────────────────────────────────────────────┘
                                   ▼
                    Narrative overlay  (when active)
                    Insight log panel  (when toggled)
```

A static screenshot is *not* committed (file size + course-policy reasons);
launch the app locally and follow `docs/DEMO_SCRIPT.md` for a guided tour.

---

## Repo layout

```text
backend/
  app/
    main.py              FastAPI app entry, CORS, route mounts
    routes/              /api/overview, /api/meso, /api/day-detail
  scripts/               Data fetch + feature/embedding builders
  requirements.txt
frontend/
  src/
    App.jsx              Title bar, case-study cards, KPI ticker, view stack
    api/                 fetchOverview / fetchMeso / fetchDayDetail
    store/useAppStore.js Zustand store (selection + narrative + insights)
    hooks/useOverview.js Cached overview fetch shared across components
    views/               MacroView · MesoView · MicroView
    components/          Charts (Horizon, ParallelCoords, SPLOM, Splat,
                         WordCloud, ThemeRiver, KPI ticker, CorrelationMatrix,
                         ClusterSummaryTable, NarrativeOverlay, Spotlight,
                         InsightDraftModal, InsightLogPanel, …)
    data/narratives.js   Authored 3-step martini-glass narratives
    utils/derived.js     pctChange / rollingMean / rollingStd / pearson …
    styles.css           Dark theme + all component classes
data/
  raw/                   GDELT + Polymarket pulls
  processed/             yfinance-cached BTC + equities
  derived/               daily_features, embedding_results, gdelt signals
  README.md              Schema + provenance per file
docs/
  README-style guides    See "Documentation map" below
```

---

## Setup — backend

Recommended environment: **Python 3.11**, conda on macOS / Linux.

```bash
conda create -n btcviz python=3.11 -y
conda activate btcviz
pip install -r backend/requirements.txt
```

Quick sanity check:

```bash
uvicorn backend.app.main:app --reload
# then in another shell
curl http://127.0.0.1:8000/api/overview | head -c 400
```

---

## Setup — frontend

Requires **Node ≥ 18**.

```bash
cd frontend
npm install
```

A production build (also useful as a smoke test):

```bash
npm run build
```

Expected output: ~106 KB gzipped initial JS, ~5 KB gzipped CSS, ECharts
chunked lazily at ~375 KB gzipped.

---

## Run the app locally

Two terminals:

```bash
# terminal 1 — backend
conda activate btcviz
uvicorn backend.app.main:app --reload
# serves http://127.0.0.1:8000

# terminal 2 — frontend
cd frontend
npm run dev
# serves http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173`. The title bar shows the data-provenance strip
once the first `/api/overview` call returns 200.

---

## Refreshing data (optional)

A canonical snapshot is committed under `data/` — you do **not** need to run
the fetchers to demo the app. Run them only when refreshing:

```bash
# yfinance: BTC-USD, COIN, MSTR, QQQ — daily + intraday
python3 backend/scripts/fetch_market_data.py
# →  data/processed/btc_daily.csv
#    data/processed/btc_intraday.csv
#    data/processed/external_assets_daily.csv

# Engineered features for the Meso view
python3 backend/scripts/build_daily_features.py
# →  data/derived/daily_features.csv

# UMAP/t-SNE embedding + KMeans clusters
python3 backend/scripts/build_embedding.py
# →  data/derived/embedding_results.csv

# GDELT — recent rolling window (kept for live demos)
python3 backend/scripts/fetch_gdelt_context.py
# →  data/raw/gdelt_selected_day/*.json
#    data/derived/gdelt_daily_signals.csv

# GDELT — historical case-study coverage (P9): per-window curated DOC
# queries that backfill COVID / War / Election / Iran windows with the
# right narrative themes (war / election / covid / regulation / macro / crypto).
python3 backend/scripts/fetch_gdelt_historical.py            # 32 hot dates only
python3 backend/scripts/fetch_gdelt_historical.py --full      # every day in every window
python3 backend/scripts/fetch_gdelt_historical.py --rebuild-signals  # cache-only rollup

# Polymarket — historical event series (P8): per-event CLOB price-history
# for curated 2024 election + 2026 Iran tension markets.
python3 backend/scripts/fetch_polymarket_history.py
# →  data/raw/polymarket_events/*.json
#    data/raw/polymarket_history/*.json
#    data/derived/polymarket_history_daily.csv
```

GDELT history goes back to **8 years** through the DOC API — the legacy
60-day guard was overly conservative. P9 added per-window curated
queries so each case-study window (COVID / War / Election / Iran)
surfaces narrative-relevant headlines, not crypto-only news.

Polymarket is a **historical time series** (P8) — the asset-context
strip in Micro shows what the crowd believed *on the selected date*,
with a 14-day post-resolution grace window so day-after-election
markets still surface. See `docs/DATA_AND_APIS.md`.

---

## Using the dashboard

For a complete walkthrough of every interaction, read
[`docs/USER_GUIDE.md`](docs/USER_GUIDE.md). Quick tour:

1. **Pick a case study** from the Case-Study Navigator at the top — this
   sets the time range *and* starts an authored narrative (martini-glass
   shell). Use → / ← / Esc to advance / rewind / exit.
2. **Watch the KPI ticker** below — six cards (BTC spot, 24h change, 30d
   annualized vol, 30d drawdown, news volume, BTC↔QQQ 30d correlation) with
   inline sparklines re-render whenever the time range changes.
3. **Brush the Macro timeline** to narrow the window further. Click a
   heatmap cell or event diamond to set the selected day.
4. **In Meso**, click a UMAP point to set both `cluster` and `selected day`.
   The regime summary table and correlation matrix update; toggle the tab
   between *Parallel Coords* and *SPLOM* for two complementary feature
   views.
5. **In Micro**, the 3-grid candlestick / volume / GDELT chart shows the
   selected day. The word cloud and theme river break down headline tone
   and theme distribution.
6. **Pin an insight** from any view header to capture the current
   `range / day / cluster` plus your free-text observation. Toggle the
   `📌 Insights` pill in the title bar to review, restore, or export
   pinned insights as JSON.

---

## Documentation map

| Doc | When to read |
|---|---|
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | First-time user. Walkthrough of every chart and interaction. |
| [`docs/VISUAL_ENCODINGS.md`](docs/VISUAL_ENCODINGS.md) | Course-grading rubric. Per-chart Munzner / Mackinlay / Bertin justification. |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | Live demo. 5–8 min presenter script with fallbacks. |
| [`docs/HEURISTIC_EVALUATION.md`](docs/HEURISTIC_EVALUATION.md) | Design rigor. Nielsen's 10 + Munzner triple + Mackinlay audit. |
| [`docs/USER_STUDY_PROTOCOL.md`](docs/USER_STUDY_PROTOCOL.md) | Running the n=4–5 formative study. |
| [`docs/INSIGHT_LOG.md`](docs/INSIGHT_LOG.md) | Schema for the in-app insight artifact + study synthesis. |
| [`docs/DATA_AND_APIS.md`](docs/DATA_AND_APIS.md) | Data sources, refresh cadence, known gaps. |
| [`docs/SCHEMAS.md`](docs/SCHEMAS.md) | Per-table column-level schemas. |
| [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) | What shipped per phase + per priority. |
| [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) | Top-level project pitch & deliverables. |
| [`AGENTS.md`](AGENTS.md) | Conventions for AI-pair-programming agents in this repo. |

---

## What changed across P1–P9

The dashboard was matured through nine approved, file-by-file priorities.
Each priority shipped *additively* — no chart, fetch path, or store slice
from earlier work was removed.

- **P1 — Credibility pass + dark theme.** Bloomberg-terminal palette,
  Western color convention, ColorBrewer RdYlGn 7-step heatmap, ColorBrewer
  Set2 cluster palette (BTC orange excluded), 5 anchored key-event
  annotations, data-provenance strip, semantic cluster labels.
- **P3 — Visualization depth.** Mirror-folded horizon graph in Macro,
  density splat + convex hulls in Meso, ECharts 3-grid candlestick +
  volume + GDELT theme bars in Micro, d3-cloud word cloud, ThemeRiver
  silhouette stacked area, derived-attribute helpers.
- **P4 — Inselberg + SPLOM.** Drag-reorder parallel-coordinates axes with
  per-axis range brushing; 4×4 SPLOM with KDE ridges on the diagonal and
  hover-linked highlighting.
- **P5 — Martini-glass narrative shell.** Zustand `narrative` slice, four
  authored 3-step narratives, spotlight ring on the active view's section,
  keyboard shortcuts, auto-scroll to the spotlit view.
- **P6 — Bloomberg-inspired information density.** KPI ticker (6 cards
  with sparklines + delta chips), 4×4 cross-asset correlation matrix,
  per-cluster summary table with equity-curve sparklines, hairline grid
  pass.
- **P7 — Heuristic eval + user study + insight log.** Pin insight from
  any view; localStorage-backed log; restore-context per row; JSON export;
  three new docs (`HEURISTIC_EVALUATION`, `USER_STUDY_PROTOCOL`,
  `INSIGHT_LOG`).
- **P8 — Date-aware historical Polymarket.** Replaces the today-only
  Gamma snapshot with curated event slugs per case-study window
  (Election 2024 + Iran 2026), CLOB `/prices-history` daily series, a
  per-market sparkline with a marker at the selected date, and a $1k
  volume floor + top-8 cap so the Iran 41-market firehose stays
  legible.
- **P9 — Date-aware historical GDELT.** Replaces the crypto-only DOC
  query + 90-day guard with **per-window curated queries** (COVID /
  War / Election / Iran) and an 8-year lookback. Topical breadth: the
  6-category theme map (war / election / covid / regulation / macro /
  crypto) keeps the headline panel and theme river populated through
  non-crypto windows. Bulk-warm script seeds 287 cached days across
  all 4 windows; the auto-rollup keeps `gdelt_daily_signals.csv` in
  sync.

(P2 was a planning-only step on the original ladder and produced no code
artifact — it set the stage for P3's depth additions.)

---

## Limitations

- **GDELT cache coverage** (post-P9) — the DOC API supports the full
  multi-year lookback we need, but it rate-limits at ~1 req / 5 s. The
  shipped cache covers all 4 case-study windows at ~55–100% per-day
  coverage; days inside a window that are not yet cached fall back to a
  live (and slower) fetch. Re-running `fetch_gdelt_historical.py --full`
  closes the gap incrementally.
- **Polymarket coverage** (post-P8) — historical price series are
  available for Election 2024 + Iran 2026 (curated event slugs). The
  COVID 2020 + Russia 2022 windows have no Polymarket coverage worth
  showing (markets too young / too thin); the UI degrades gracefully
  with a friendly message instead of empty cards.
- **Mobile / narrow viewport** — the dashboard collapses gracefully but is
  not optimized below ~960 px. Course demo target is laptop / projector.
- **Color-blindness** — palettes are ColorBrewer CB-safe, but a full
  cross-test is deferred.

---

## License & credits

Course project, **HKUST MSBD5005 (Spring 2026)**. Data sources retain their
respective licenses (yfinance / Yahoo Finance, GDELT 2.0, Polymarket Gamma
API). Code is for academic use unless otherwise noted in commit history.

Visualization design borrows liberally from Munzner (*Visualization
Analysis & Design*), Mackinlay (1986), Inselberg (parallel coordinates),
Heer & Bostock (horizon graphs), Segel & Heer (martini-glass narrative
visualization), and the Bloomberg Terminal's UI craft.
