# Demo Script

A 5–8 minute live walkthrough of the BTC Multi-Scale Visualization
dashboard. This script reflects the **post-P7** state of the system —
it integrates the case-study navigator (P1), event overlays (P2),
narrative overlay (P5), Bloomberg-style KPI ticker + Meso summary
panels (P6), and the insight-log (P7).

For the *why* behind each chart see `VISUAL_ENCODINGS.md`. For
operational details see `USER_GUIDE.md`.

---

## 0. Before the demo

1. Backend up: `uvicorn backend.app.main:app --reload` (port 8000).
2. Frontend up: `npm run dev` from `frontend/` (port 5173).
3. Refresh recent context if presenting today:
   - `python3 backend/scripts/fetch_gdelt_context.py --days 14`
   - `python3 backend/scripts/fetch_polymarket_context.py`
4. Open Chrome at `http://localhost:5173`. Browser zoom 100 %.
5. In DevTools console, clear stale insights so the panel starts empty:
   ```js
   localStorage.removeItem('btc-multi-scale.insights.v1');
   ```
6. Confirm `/api/overview` returns 200 (Network tab).

Recommended demo length: **5–8 minutes** (3 minutes if you skip the
narrative auto-play).

---

## 1. Opening (30 s)

> "This is a coordinated multi-scale BTC market dashboard. Three views —
> Macro, Meso, Micro — share one Zustand store, so a brush in one view
> propagates everywhere. The hypothesis we're testing visually: BTC's
> behavior is regime-driven, and regimes line up with macro events."

Point out the **title bar**, the **case-study navigator**, the
**KPI ticker**, and the **status strip** (provenance — yfinance + GDELT
+ Polymarket).

---

## 2. Macro — the long-term picture (90 s)

1. Click **Full Range** in the macro time-range strip.
2. Read the **horizon graph** out loud: "this stacks 7-day rolling
   returns into 3 mirrored bands — same data accuracy as a line chart
   in 1/3 the height (Heer 2009)."
3. Brush 2020 on the BTC timeline.
4. Hover the deepest red cell in the **calendar heatmap** — *2020-03-12*.
5. Click that cell. Note that the selectedDate propagates immediately
   to Meso and Micro.
6. Press **📌 Pin insight** on the Macro header: *"Black Thursday is the
   single deepest cell in the heatmap for the COVID window."* Save with
   ⌘/Ctrl+Enter.

> "We just used Macro to *locate* an anomaly. The pinned insight is the
> reproducible state — view + window + date + note — saved to
> localStorage."

---

## 3. KPI ticker — Bloomberg-style situational awareness (30 s)

Point at the 6-card row above the views:

- BTC spot + 24 h delta chip
- 30 d annualized vol
- 30 d max drawdown
- 1 d news volume
- 30 d BTC ↔ QQQ correlation

> "Each card is a tabular numeric + 60-pt sparkline (Tufte). The colored
> ▲/▼ chip uses redundant shape + hue — readable for deuteranopes."

---

## 4. Meso — pattern discovery (90 s)

1. Click the **War Regime** case-study chip (or stay in COVID).
2. UMAP scatter: point out the **density splat** behind the dots and
   the **convex hulls** with cluster centroids.
3. Click one cluster swatch in the legend; the parallel-coordinates plot
   below filters to that cluster.
4. Scroll to the **Regime Summary** band:
   - **Cluster summary table** — n / mean return / mean σ / equity-curve
     sparkline per cluster.
   - **4×4 correlation matrix** — Pearson(BTC, COIN, MSTR, QQQ) over the
     active window. Diverging green↔red, anchored at zero.
5. Toggle Parallel Coords ↔ SPLOM if time permits.
6. Pin an insight from Meso: *"Risk-Off cluster dominates the war week —
> visible as the bottom row of the summary table with the most days
> and the steepest negative equity sparkline."*

---

## 5. Micro — drill into one day (75 s)

1. With the date already propagated from the Macro click, scroll to
   Micro.
2. Walk through the 3-grid ECharts panel:
   - Top: candlestick (OHLC)
   - Middle: volume bars
   - Bottom: GDELT count bars
   "Shared x-axis = aligned position judgments — the highest-accuracy
   channel in Cleveland & McGill."
3. Read 2–3 tokens from the **word cloud** and call out the dominant
   theme.
4. Show the **theme river** (`stackOffsetSilhouette` — Havre 2002).
5. Show the **asset-context strip** (BTC / COIN / MSTR / QQQ
   sparklines) and the **Polymarket cards** if available.
6. Pin an insight: theme + price candle direction.

---

## 6. Narrative overlay — guided story (60 s)

1. Click **COVID Shock** in the case-study navigator.
2. The narrative auto-plays: a spotlight dims non-active views by 70 %.
3. Use the **right-arrow key** to advance through the 3 steps.
4. Pin one insight per step (they show up in the slide-in panel
   accumulating in real time).

> "Pattern: Segel & Heer's *martini-glass* — start guided, end free.
> The user is dropped back into full exploration after step 3."

---

## 7. Insight log — the analytic artifact (30 s)

1. Click **📌 Insights (n)** pill in the title bar.
2. The slide-in panel shows the four pinned insights from this demo.
3. Click any row → **Restore context** — store snaps back to that
   view/range/date/cluster.
4. Click **Export JSON** — `insights-YYYY-MM-DD.json` downloads.

> "This is the artifact format used in the user-study protocol
> (`USER_STUDY_PROTOCOL.md`). It's also why the schema document exists —
> we promise a stable v1 contract."

---

## 8. Closing (15 s)

> "The contribution is not one chart but the coordinated *flow* —
> overview → pattern → detail, each scale answering a different
> question, all sharing one store, with insight-pinning turning each
> demo session into a reproducible artifact."

---

## Recommended case studies

### COVID Shock — `2020-02-01` to `2020-06-30`
Emphasize regime shift, vol expansion, and the 2020-03-12 anomaly. No
GDELT history (60-day rolling), so lean on price structure + heatmap.

### Election Cycle — `2024-09-01` to `2025-01-31`
Emphasize policy framing, BTC/QQQ co-movement in the correlation
matrix, and the 2024-11-06 election-day word cloud (`trump`, `crypto`,
`etf`).

### Iran Tension — `2026-03-01` to `2026-04-09`
Strongest live window — GDELT headlines, theme river, and Polymarket
all available. Best for showing the full Macro → Meso → Micro chain.

### War Regime — `2022-02-01` to `2022-05-31`
Best Meso story: invasion day clusters with 2020 panic days in
*Risk-Off*. Use the cluster summary table to make the case quantitative.

---

## Failure mitigations

### GDELT headlines missing
> "GDELT's API has a 60-day rolling window. Older case studies fall
> back to local context — the design is intentionally tolerant."

### Polymarket missing
> "Polymarket is a minimal live snapshot, not historical. It's
> expectation context, not signal."

### Selected day has no intraday data
> "Provider intraday limits vary; we fall back to the daily window so
> the rest of the panel still works."

### Insight panel empty after refresh
The panel is `localStorage`-backed; if the user cleared it via the
"Clear all" button or via DevTools, it's gone. Re-pin a few insights
to seed the demo.
