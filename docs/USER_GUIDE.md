# User Guide

A complete walkthrough of every interaction surface in the dashboard.
This is the doc to read when you sit down with the app for the first time.

---

## Table of contents

1. [Mental model](#mental-model)
2. [Title bar & global affordances](#title-bar--global-affordances)
3. [Case-Study Navigator](#case-study-navigator)
4. [KPI ticker](#kpi-ticker)
5. [Status & provenance strips](#status--provenance-strips)
6. [Macro view](#macro-view)
7. [Meso view](#meso-view)
8. [Micro view](#micro-view)
9. [Narrative overlay (martini glass)](#narrative-overlay-martini-glass)
10. [Insight log](#insight-log)
11. [Keyboard shortcuts](#keyboard-shortcuts)
12. [Troubleshooting](#troubleshooting)

---

## Mental model

The dashboard has three *coordinated* views built around a tiny shared
selection:

- `selectedTimeRange` — `{start, end}` ISO dates. Filters Macro and feeds
  every fetch.
- `selectedDate` — one ISO date. Drives Micro and highlights in Macro/Meso.
- `selectedCluster` — one integer cluster id. Filters Meso highlights.

Every interaction either *sets* one of these or *reads* them. There are no
hidden tabs or modals you need to discover. State flows top-to-bottom:

```
Case-Study Navigator  →  selectedTimeRange
            ↓
KPI ticker · Macro     ←  re-render
            ↓ (brush, click)
Macro                  →  selectedTimeRange / selectedDate
            ↓
Meso                   →  selectedCluster / selectedDate
            ↓
Micro                  ←  re-render
```

---

## Title bar & global affordances

Top of the page, three elements:

| Element | What it does |
|---|---|
| **Title + subtitle** | Static. Sets context: "follow the workflow Macro → Meso → Micro". |
| **`📌 Insights (n)` pill** *(top-right)* | Toggles the Insight log panel. The number is the count of pinned insights in localStorage. Clicking opens the panel; clicking again closes. |

---

## Case-Study Navigator

Four cards: **COVID Shock**, **War Regime**, **Election Cycle**, **Iran
Tension**. Each card shows its date window and a one-line description.

- **Click a card** to set the time range *and* start that case study's
  authored 3-step narrative (see *Narrative overlay* below). The active
  card is highlighted with a brighter border.
- The window dates are also visible in the active KPI ticker, status strip,
  and Macro time-range buttons.

Use these as the demo "warp points". For free exploration, just brush the
Macro timeline directly — that bypasses narratives.

---

## KPI ticker

Six dense cards in a single row, each with: label · big tabular value ·
optional ▲/▼ delta chip · 26-px area+line sparkline.

| Card | Value | Sparkline |
|---|---|---|
| **BTC Spot** | Last close price ($), with 24h change as ▲/▼ chip | 30-day price |
| **24h Change** | Last daily return (%) | 7-day daily returns |
| **30d Vol (ann.)** | √252 × stdev of daily returns over last 30 days (%) | 60-day rolling vol |
| **30d Drawdown** | Last close vs. rolling 30-day high (%) | 90-day drawdown |
| **News Vol (1d)** | GDELT headline count for the most recent day | 14-day headline counts |
| **30d Corr · QQQ** | Pearson(BTC daily ret, QQQ daily ret) over last 30 days | 60-day rolling corr |

The ticker re-renders whenever `selectedTimeRange` changes. Cards never
"update in place" — they always reflect the *end* of the currently selected
window.

---

## Status & provenance strips

Below the KPI ticker:

- **Status strip** — three pills (Range · Cluster · Selected Day). At-a-
  glance answer to "what selection am I currently driving?".
- **Data-provenance strip** — four chips (BTC OHLCV / Equities / GDELT
  News / Polymarket) with `Cached`, `Live`, or `Snapshot` status badges.
  Useful for explaining limitations during a demo.

---

## Macro view

Three sections, top-to-bottom.

### Time-range buttons

Five quick presets: **Full Range**, COVID Window, War Window, Election
Window, Iran Window. Active button = highlighted. Same as case studies but
without launching a narrative.

### Rolling Return & Volatility (Horizon)

A *mirror-folded* horizon graph stacked above the BTC timeline:

- Top track: 7-day rolling return (centered on zero, green for positive,
  red for negative).
- Bottom track: 30-day rolling volatility (one-sided, since vol ≥ 0).
- Each track uses **4 bands per side**; darker band = more extreme.

Reading rule: if the top track is all-green and dark, BTC just had a
strong up-week; if dark red, a strong down-week.

### BTC Long-Term Timeline

The headline chart:

- **Line + area** in BTC orange.
- **Diamond markers** above the line = GDELT event-overlay days. Marker
  size scales with `news_count`. Click a diamond to set `selectedDate`.
- **Annotation labels** for 5 anchored key events (COVID crash, halvings,
  ETF approval, Iran tension) with leader lines.
- **Brush interaction** — click-and-drag horizontally on the chart body
  to commit a tighter `selectedTimeRange`. A faint blue rectangle previews
  the selection while you drag.
- **Selected-day marker** — a larger orange circle with a white outline at
  the active `selectedDate`.

### Calendar Heatmap

Per-month grids of daily cells, ColorBrewer **RdYlGn 7-step** with Western
convention (green = up). Symmetric thresholds at ±0.5 % / ±2 % / ±5 %.

- Each cell title shows the daily return; clicking sets `selectedDate`.
- Cells with GDELT events get a small dot in the corner (saturation
  scales with `news_count`: 1–9 vs. 10+).
- The legend strip at the top shows the diverging ramp + event-intensity
  swatches.

### Event-overlay summary

The *5 highest-news-count days in the loaded window*, shown as cards with
the top headline. Click a card to jump `selectedDate` there.

Since P9 each case-study window has its own curated DOC API query
(COVID / War / Election / Iran) so the headline summary is meaningful
inside *every* curated window, not just the recent Iran one. Dates
outside any curated window fall back to a broadened generic query
(bitcoin + macro + geopolitics).

---

## Meso view

Four sections.

### Cluster selector

A row of buttons — one per regime (semantic labels like *Panic Sell-off*,
*Volatile Recovery*, *Calm Range*) plus **Clear**. Clicking sets
`selectedCluster`; clicking the active one or **Clear** unsets it.

The swatch on each button uses the same ColorBrewer **Set2** color the
scatter and parallel coords use, with BTC orange explicitly excluded so
the BTC line in Macro stays unique.

### Embedding Scatterplot

UMAP 2-D projection of the daily feature vector.

- **Background** — a single-hue (BTC orange, low opacity) **density splat**
  built from `d3.contourDensity`. Highlights the bulk of the point cloud
  without competing with cluster colors.
- **Convex hulls** — one per cluster, dashed outline + 12 % fill, with the
  cluster's semantic label at the centroid.
- **Points** — every visible day, colored by cluster. Selected day = larger
  with a white halo. Selected cluster = full opacity, others fade to 18 %.
- Click a point → sets *both* `selectedCluster` and `selectedDate`. Hover
  a hull → that cluster brightens, others fade.

### Regime Summary (P6)

Two-column layout: cluster summary table on the left, 4×4 correlation
matrix on the right.

**Cluster summary table** — one row per cluster, sorted by mean daily
return descending:

| Column | Meaning |
|---|---|
| Swatch | Cluster color |
| Regime | Semantic label |
| `n` | Day count in cluster |
| Mean Ret | Mean daily return (% — green if ≥ 0, red otherwise) |
| Mean Vol | Mean rolling-30d volatility (%) |
| Mean DD | Mean drawdown from 30d high (% — red if ≤ −10 %) |
| Equity curve | Cumulative (1 + r) sparkline restricted to days in this cluster, with a dashed reference line at 1.0 |

Click a row to toggle that cluster as `selectedCluster`.

**Correlation matrix** — 4×4 BTC / COIN / MSTR / QQQ Pearson correlations
of daily returns over the selected window. Diagonal cells use a different
fill (always 1.00); off-diagonals interpolate from dark base toward green
(positive) or red (negative). Hover any cell for full 4-digit precision.

### Meso Feature Explanation

Toggle tab between **Parallel Coords** and **SPLOM (top-4)**:

- **Parallel Coords (Inselberg)** — one axis per feature
  (`daily_return`, `open_close_change`, `high_low_range`,
  `volume_zscore`, `rolling_volatility_7d`, `rolling_volatility_30d`,
  `drawdown_from_30d_high`). Faint daily lines (subsampled to ≤ 600) under
  bold cluster-mean lines. Drag any axis label to **reorder axes**;
  click-and-drag inside an axis to **brush a numeric range**. Reset axes /
  Clear brushes buttons in the chart header.
- **SPLOM (top-4)** — 4×4 scatterplot matrix over `daily_return`,
  `rolling_volatility_30d`, `volume_zscore`, `drawdown_from_30d_high`.
  Diagonals show **KDE ridges**; off-diagonals show colored points. Hover
  any point in any cell to **link-highlight** the same date across all
  cells. Click a point to set `selectedDate` + `selectedCluster`.

---

## Micro view

Activates when `selectedDate` is non-null. If no date is selected, you'll
see a placeholder pointing back to Macro/Meso.

### 3-grid intraday chart (ECharts)

Three horizontally-aligned panels sharing the same x-axis (time-of-day):

1. **Candlestick** — open / high / low / close. Western convention: green
   body for bullish (close ≥ open), red for bearish.
2. **Volume bars** — colored to match the candle direction.
3. **GDELT theme bars** — stacked count of headlines per theme
   (regulation / war / election / crypto / other) per hour. Same theme
   palette as the theme river below.

If the day has no intraday data (provider gap), the panel falls back to a
±15-day daily window centered on the selected date.

### Word cloud (P3)

`d3-cloud` layout over the day's headline tokens (≥ 3 chars, stop-worded).
Word size = frequency; word color = mean tone (green for positive, red for
negative, grey for neutral). Tooltip shows the underlying tone value.

### Theme river (P3)

A `d3.stack` silhouette layout (ThemeRiver, Havre et al. 2002) of
headlines bucketed into 24 hour-bins, stacked by theme. Curve uses
`d3.curveBasis` for legibility. Same color encoding as the GDELT bars in
the candlestick chart.

### Asset-context strip

Compact strip under the chart showing the selected day's price and 1-day
% move for COIN, MSTR, and QQQ (whatever is in `external_assets_daily`).
Useful for "did the equity proxies move with BTC?".

### Polymarket context (P8 — date-aware historical)

Cards now show the **historical** YES probability for curated markets
that were live on the *selectedDate*:

- **Big number** = YES price on the selected date (closest daily point ≤
  target). Green ≥ 0.5, red < 0.5.
- **Sparkline** = the market's full daily price history. The vertical
  hairline + dot mark the selected date.
- **Footer** = total volume + number of daily price observations.

Coverage by case-study window:

| Window | Polymarket coverage |
|---|---|
| COVID Shock (2020) | none — Polymarket too young |
| War Regime (2022) | none — markets too illiquid |
| Election Cycle (2024) | rich — Trump/Harris, BTC ATH, ETF |
| Iran Tension (2026) | rich — Iran nuclear/strike, Fed |

For dates outside a covered window the card shows a graceful
"no Polymarket coverage for this date" message. Refresh the cache via
`python3 backend/scripts/fetch_polymarket_history.py --refresh`.

---

## Narrative overlay (martini glass)

Activates when you click a case-study card. A floating card appears at the
bottom-right of the screen:

- Step pips at the top (filled = done, glowing = active).
- Step title + body explaining what to look at *right now*.
- Back / Next buttons.
- ✕ exit button.

When a step has a *spotlight* attached, the corresponding view (Macro /
Meso / Micro) gets a glowing amber ring and auto-scrolls into view.

Each narrative is 3 steps:

1. **Establishing shot** — wide window, no specific day.
2. **Highlight** — one anchor day with the strongest signal.
3. **Free exploration** — releases you into normal interaction; overlay
   dismisses.

Reaching step 3 transitions `narrativeMode` from `playing` to `released`,
unlocking everything that the narrative had focused.

### Keyboard shortcuts (when overlay is active)

| Key | Action |
|---|---|
| → or Space | Advance one step |
| ← | Step back |
| Esc | Cancel narrative immediately |

These shortcuts are scoped to the overlay — they don't trigger when an
input is focused, and they're disabled in idle mode.

---

## Insight log

Two pieces.

### Per-view pin button

Each view header has a small ghost button: **📌 Pin insight**. Click it to
open the Insight Draft modal:

- Read-only chips capture the *current* `view`, `range`, `date`, `cluster`.
- A textarea collects your free-text observation.
- **Save** (or `⌘/Ctrl + Enter`) → appends to the log and closes the modal.
- **Cancel** (or `Esc`) → discards.

Notes shorter than 1 trimmed character are silently dropped (no
empty-saves).

### Title-bar pill + slide-in panel

The `📌 Insights (n)` pill in the title bar toggles the panel from the
right. Each row shows:

- Timestamp.
- The note itself.
- Context chips (view, range, date, cluster).
- **Restore context** — sets `selectedTimeRange / Date / Cluster` back to
  what was captured. Useful for "jump back to the moment I noticed this".
- ✕ remove.

Footer:

- **Export JSON** — downloads `insights-YYYY-MM-DD.json` with the full
  cohort in the schema documented in `docs/INSIGHT_LOG.md`.
- **Clear all** — wipes the log (with `window.confirm` guard).

The log is stored at the localStorage key
`btc-multi-scale.insights.v1` and survives reloads.

---

## Keyboard shortcuts

| Scope | Key | Action |
|---|---|---|
| Narrative active | → · Space | Advance |
| Narrative active | ← | Step back |
| Narrative active | Esc | Exit narrative |
| Insight modal open | Esc | Cancel draft |
| Insight modal open | ⌘/Ctrl + Enter | Save draft |

Inputs and textareas always swallow these shortcuts — you can type freely
in the insight modal without triggering accidental advances.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| KPI cards show "—" | Backend not running, or no data for the selected window | Confirm `uvicorn` is up; check the browser console for `/api/overview` errors. |
| Event diamonds missing in Macro | GDELT cache for that date not yet warmed | Run `python3 backend/scripts/fetch_gdelt_historical.py` (or `--full` for every window day). |
| Headline panel feels off-topic for the date | The date sits outside every curated window and is using the generic fallback query | Pick a date inside one of the four case-study chips (COVID / War / Election / Iran) — each has its own tailored query in `gdelt_curated.py`. |
| Polymarket cards missing | Gamma/CLOB API rate-limited or offline | Re-run `python3 backend/scripts/fetch_polymarket_history.py --refresh`; the dashboard always serves the on-disk cache when remote fails. |
| "No Polymarket coverage for this date" | Selected date outside curated buckets (COVID, 2022 war) | Expected — coverage is only for the Election (2024) and Iran (2026) windows. |
| Selected day shows daily fallback chart | yfinance has no intraday for that day | Expected on weekends and beyond the intraday lookback. The fallback is intentional. |
| Insight panel empty after refresh | Different browser profile, or localStorage was cleared | Insights are scoped per browser. Use **Export JSON** to back up before clearing site data. |
| Build fails on `npm run build` | Node < 18 | `nvm install 18 && nvm use 18`. |

For deeper debugging, see `docs/DATA_AND_APIS.md` and the route handlers in
`backend/app/routes/`.
