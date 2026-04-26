# Development Roadmap

## Phase 0 — Repo and scaffolding ✅
- Folder layout, docs, schemas, build scripts.

## Phase 1 — Data ingestion ✅ (with caveats)
- yfinance fetchers for BTC + COIN/MSTR/QQQ — ✅
- GDELT 2.0 DOC API filtered extraction (60-day rolling) — ✅
- Polymarket Gamma API minimal snapshot — ✅
- Data-quality checks — ✅

## Phase 2 — Derived data ✅
- BTC daily OHLCV table.
- Engineered feature table (returns, vol, drawdown, news intensity, …).
- UMAP 2-D projection.
- KMeans (k=5) cluster labels.

## Phase 3 — Frontend MVP ✅
- **Macro:** BTC line, calendar heatmap, time brush, event markers.
- **Meso:** UMAP scatter, cluster brushing, parallel coordinates.
- **Micro:** 3-grid candlestick, headline panel, Polymarket cards.

## Phase 4 — Linking & polish ✅
- Macro → Meso filtering by selectedTimeRange.
- Meso → Micro by selectedDate.
- Backtracking highlights (selected-day dot + cluster swatch).
- Initial case-study story flow.

## Phase 5 — Enhancements ✅
- GDELT theme enrichment + theme river.
- Polymarket overlay tied to selectedDate.
- Annotation system (event markers, kicker labels, regime hulls).
- Presentation polish.

---

## Phase 6 — P1–P7 maturation (delivered end of P7)

A staged additive pass that did **not** rewrite the MVP — every
priority shipped on top of the existing architecture. Bundle deltas
tracked at every step against the gzip budget.

| Priority | Deliverable | Files touched | Bundle delta (gzip) | Status |
|---|---|---|---|---|
| **P1 — Case-study navigator** | Three preset windows (COVID / Election / Iran) wired to `selectedTimeRange`. | `App.jsx`, `useAppStore.js`, `styles.css` | +0.8 KB JS, +0.3 KB CSS | ✅ |
| **P2 — Event annotation overlay** | Macro line + heatmap event markers (FOMC, war, invasion …) with shape-encoded kinds. | `MacroView.jsx`, `data/events.js`, `styles.css` | +1.4 KB JS | ✅ |
| **P3 — Micro v2** | 3-grid ECharts candle/volume/GDELT, word cloud (d3-cloud), theme river (`stackOffsetSilhouette`). | `MicroView.jsx`, new `WordCloud.jsx`, `ThemeRiver.jsx` | +6.1 KB JS | ✅ |
| **P4 — Meso v2** | Density splat (`d3.contourDensity`), convex hulls + centroid labels, k=5 cluster legend. | `MesoView.jsx`, `ScatterUmap.jsx` | +2.0 KB JS | ✅ |
| **P5 — Narrative overlay** | Segel & Heer martini-glass with auto-play, ←/→ keys, 70 % spotlight dim. | `NarrativeOverlay.jsx`, `data/narratives.js`, store narrative slice | +1.6 KB JS, +1.0 KB CSS | ✅ |
| **P6 — Bloomberg craft pass** | KPI ticker (6 cards + sparklines + delta chips), 4×4 correlation matrix, cluster summary table with equity-curve sparklines, hairline-grid polish. | `KpiTicker.jsx`, `CorrelationMatrix.jsx`, `ClusterSummaryTable.jsx`, `useOverview.js`, `utils/derived.js` | +3.1 KB JS, +0.6 KB CSS | ✅ |
| **P7 — Evaluation + insight log** | Pin button on every view, draft modal (⌘/Ctrl+Enter to save), slide-in log panel with restore-context + JSON export, localStorage persistence (`v1` schema). Heuristic eval + user-study protocol + insight-log spec docs. | `PinInsightButton.jsx`, `InsightDraftModal.jsx`, `InsightLogPanel.jsx`, store insight slice, `docs/HEURISTIC_EVALUATION.md`, `docs/USER_STUDY_PROTOCOL.md`, `docs/INSIGHT_LOG.md` | +2.0 KB JS, +0.8 KB CSS | ✅ |

### End-of-P7 bundle (gzip)
- CSS: **4.82 KB**
- JS:  **105.45 KB**

Both well under the agreed budget (CSS ≤ 6 KB, JS ≤ 130 KB).

---

## Documentation (delivered end of P7)

| File | Purpose |
|---|---|
| `README.md` | Top-level entry: pitch, repo layout, setup, P1–P7 changelog. |
| `docs/USER_GUIDE.md` | Operational walkthrough — every interaction surface. |
| `docs/VISUAL_ENCODINGS.md` | Per-chart Munzner / Mackinlay / Bertin justification. |
| `docs/HEURISTIC_EVALUATION.md` | Nielsen 10 + Munzner what/why/how audit + residuals. |
| `docs/USER_STUDY_PROTOCOL.md` | n=4–5 formative study protocol + SUS-10. |
| `docs/INSIGHT_LOG.md` | Schema + seed insights + scoring rubric. |
| `docs/DEMO_SCRIPT.md` | 5–8 min live walkthrough. |
| `docs/DATA_AND_APIS.md` | Source provenance + refresh recipes. |
| `docs/SCHEMAS.md` | Backend response shapes. |
| `docs/MASTER_PLAN.md` | Original project pitch. |
| `docs/TASK_BREAKDOWN.md` | Granular task ledger (kept for history). |
| `docs/CODEX_AGENT_GUIDE.md` | Agent runbook. |

---

## Beyond P7 (future work, non-blocking)

- **Light theme** — would require re-tuning every diverging scale.
- **Cross-window comparison view** — split-screen two case studies side
  by side; current flow only supports one window at a time.
- **Insight log v2** — tags, severity, multi-participant merge tooling
  (the `v1` schema already reserves the namespace bump).
- **Backend Parquet caching** — current cached CSVs are fine at this
  scale but Parquet would shave first-paint latency.
- **Realtime push** — websocket for the latest BTC tick; currently
  polling on overview load.

These are **explicitly out of scope** for the course deliverable — the
design contract was "do not break the basic structure to chase new
features" (additive maturation only).

---

*Roadmap last updated: end of P7. The five Phase 0–5 items pre-date
the additive P1–P7 pass; every P-item shipped on top of them without
rewriting the MVP.*
