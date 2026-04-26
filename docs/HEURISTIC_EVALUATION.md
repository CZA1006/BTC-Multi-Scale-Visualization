# Heuristic Evaluation — BTC Multi-Scale Visualization

This document records a structured heuristic evaluation of the dashboard
shipped through priorities P1–P7. It combines three lenses:

- **Nielsen's 10 usability heuristics** — for general UI quality.
- **Munzner's nested model** *(Visualization Analysis & Design, 2014)* — for the
  validity of task → data → encoding → algorithm choices.
- **Mackinlay's effectiveness ranking** *(1986)* — for how well each visual
  channel matches the data type it carries.

Two evaluators (the design team) walked the dashboard end-to-end, executing
the five tasks defined in `USER_STUDY_PROTOCOL.md`. Each issue was rated on
Nielsen's 0–4 severity scale:

- **0** — not a problem
- **1** — cosmetic
- **2** — minor (annoyance, low priority)
- **3** — major (impedes task completion)
- **4** — catastrophic (must fix before release)

---

## 1. Methodology

Each evaluator independently produced a list of findings while completing
the five user-study tasks. Lists were merged and de-duplicated; severity was
agreed by discussion. We then mapped each finding to whichever priority
(P1–P7) addressed it, and recorded any residual issues that persist.

We deliberately use *both* Nielsen (UI heuristics) *and* Munzner/Mackinlay
(viz heuristics) because a chart can be Nielsen-clean and still misencode the
data, or Mackinlay-correct and still confusing in workflow.

---

## 2. Nielsen heuristic findings

| # | Heuristic | Finding | Severity | Resolved by | Status |
|---|---|---|---|---|---|
| H1 | Visibility of system status | Initial dashboard had no live indicator of *which* time range was driving Macro/Meso/Micro at a glance. | 3 | **P1** added the status-strip showing Range / Cluster / Selected Day; **P6** added the KPI ticker that re-renders on every state change. | ✓ Fixed |
| H2 | Match between system and the real world | Bullish/bearish color in v0 used red=up (an anti-Western convention from East-Asia trading platforms). | 3 | **P1** standardized on Western convention (`--pos: #2ca02c`, `--neg: #d62728`) and applied it to candlesticks, heatmap, KPI deltas, horizon graphs. | ✓ Fixed |
| H3 | User control and freedom | Once a narrative started in early P5 builds, there was no Esc/exit affordance — the user was trapped in the linear flow. | 3 | **P5** added explicit Exit (✕) button + Esc shortcut; the martini glass *also* releases to free exploration after the last step. | ✓ Fixed |
| H4 | Consistency and standards | Time-range buttons, narrative buttons, and panel CTAs originally used three different button styles. | 2 | **P1** unified on `.range-button(-active)` across all three views; **P5–P7** reused the same class for narrative + insight actions. | ✓ Fixed |
| H5 | Error prevention | "Clear all insights" can destroy non-trivial work. | 2 | **P7** added a `window.confirm` guard before clearing the insight log. | ✓ Fixed |
| H6 | Recognition rather than recall | Cluster IDs in v0 were raw integers (0, 1, 2 …), forcing users to remember "0 = panic". | 3 | **P1** introduced `getClusterSemanticLabel()` (e.g. *Panic Sell-off*, *Volatile Recovery*); used in scatter labels, hull annotations, summary table, narrative copy. | ✓ Fixed |
| H7 | Flexibility and efficiency of use | Power users have no quick switch between Parallel Coords and SPLOM in Meso. | 2 | **P4** added a tab-row that toggles `mesoSecondaryView` without scrolling. | ✓ Fixed |
| H8 | Aesthetic and minimalist design | The Macro view originally rendered every daily point as a circle, creating a 1500-circle blizzard. | 2 | **P1** made dense windows render only the selected day's marker; **P3** moved rolling stats to a dedicated horizon graph instead of overlaying. | ✓ Fixed |
| H9 | Help users recognize, diagnose, and recover from errors | When a window has no GDELT coverage (historical), the empty event-overlay panel had no explanation. | 3 | **P1** added an "isHistoricalGdeltWindow" detection + explanatory copy pointing to the Iran window, distinguishing "no data" from "no events". | ✓ Fixed |
| H10 | Help and documentation | Demo presenter needed an external script to remember the workflow. | 2 | **P5** authored four narratives (`covid`, `war`, `election`, `iran`) embedded in the app; the spotlight ring + step copy is in-app help. | ✓ Fixed |

### Residual Nielsen issues

| # | Finding | Severity | Mitigation |
|---|---|---|---|
| R1 | Reduced-motion users still see the narrative pop-in animation. | 1 | Add `prefers-reduced-motion: reduce` rule (out of scope for course demo, deferred). |
| R2 | Insight modal's textarea has no character cap; very long notes wrap awkwardly in the panel. | 1 | Could add a soft cap of ~500 chars and a counter. Documented for follow-up. |
| R3 | The KPI ticker's "30d Drawdown" card uses red sparkline regardless of sign — visually loud even when drawdown is shallow. | 1 | Could scale opacity by magnitude. Acceptable for the demo. |

---

## 3. Munzner / Mackinlay encoding audit

For each chart we list (channel × visual variable × Mackinlay rank for the
data type encoded). Lower rank = more effective. We flag any rank ≥ 3 used
on a quantitative attribute, since position/length/angle (ranks 1–3) should
be preferred for Q-data.

### 3.1 Macro view — BTC Long-Term Timeline

| Channel | Attribute | Type | Mackinlay rank | Notes |
|---|---|---|---|---|
| Position-x | Date | T (ordered) | 1 | ✓ Optimal for time. |
| Position-y | Close | Q | 1 | ✓ Optimal for quantitative. |
| Hue | Selected vs. unselected | C (binary) | 1 | ✓ Color identity is appropriate for the categorical highlight. |
| Size (event marker) | News volume | Q | 5 | △ Size is rank 5 for Q. We accept this because the event markers are *secondary* — the primary encoding remains position. The double-encoding via `<title>` tooltip mitigates. |

### 3.2 Macro view — Calendar Heatmap

| Channel | Attribute | Type | Mackinlay rank | Notes |
|---|---|---|---|---|
| Position (cell row × col) | Date | T | 1 | ✓ |
| Color (RdYlGn 7-step) | Daily return | Q (diverging) | 4 | △ Color saturation is rank 4 for Q, but ColorBrewer's perceptual uniformity + a 7-step quantization makes this acceptable. Direct numerical readout is on hover. |
| Marker dot (corner) | Event intensity | O (3-level) | 4 | ✓ Ordinal levels (none / 1–9 / 10+) are well-served by 3-step saturation. |

### 3.3 Macro view — Horizon graph (P3)

| Channel | Attribute | Type | Mackinlay rank | Notes |
|---|---|---|---|---|
| Position-x | Date | T | 1 | ✓ |
| Position-y (folded) | |return| or |vol| | Q | 1 | ✓ |
| Color band | sign × magnitude bin | Diverging Q | 4 | ✓ Color is the trade-off horizon graphs make for vertical compression — accepted by literature *(Heer et al., 2009)*. |

### 3.4 Meso view — UMAP scatter

| Channel | Attribute | Type | Mackinlay rank | Notes |
|---|---|---|---|---|
| Position-x, y | UMAP-x, UMAP-y | Q (positional, no inherent units) | 1 | ✓ |
| Hue | Cluster id | C (≤ 8) | 1 | ✓ Set2 palette, BTC-orange excluded. |
| Lightness/opacity | Selection state | Q (computed) | 6 | △ Rank 6 for Q but only used for the *2-state* highlight (selected vs. faded), so effectively categorical. |
| Hull boundary + label | Cluster region | C | 1 | ✓ Position + enclosure (Bertin) for cluster identity. |

### 3.5 Meso view — Parallel coords + SPLOM (P4)

| Channel | Attribute | Type | Mackinlay rank | Notes |
|---|---|---|---|---|
| Position (axis-y) | Each feature | Q | 1 | ✓ |
| Hue | Cluster | C | 1 | ✓ |
| Brush extent | Filter | Interaction | n/a | ✓ Inselberg-style range brushing on each axis. |
| KDE diagonal in SPLOM | Density | Q | 1 (position) | ✓ Position-based ridges, rank 1. |

### 3.6 Meso view — Correlation matrix + cluster summary table (P6)

| Channel | Attribute | Type | Mackinlay rank | Notes |
|---|---|---|---|---|
| Color (diverging green ↔ red) | Pearson correlation | Q (bipolar) | 4 | △ Acceptable: matrix is small (4×4), every cell has a tabular numeric overlay. |
| Position (table column) | Mean return / vol / dd | Q | 1 | ✓ Pure numerics in a table, with sparklines for shape. |
| Sparkline area + line | Equity curve | Q | 1 | ✓ Position-based mark, dashed baseline at index = 1. |

### 3.7 Micro view — Candlestick + volume + GDELT bars (P3)

| Channel | Attribute | Type | Mackinlay rank | Notes |
|---|---|---|---|---|
| Position-x | Time-of-day | T | 1 | ✓ |
| Position-y | OHLC | Q | 1 | ✓ |
| Hue (green/red body) | Up/down candle | C (binary) | 1 | ✓ Western convention. |
| Length (volume bar) | Volume | Q | 2 (length) | ✓ |
| Length (theme-stacked bar) | Theme counts | Q | 2 | ✓ |

### 3.8 Micro view — Word cloud + theme river (P3)

| Channel | Attribute | Type | Mackinlay rank | Notes |
|---|---|---|---|---|
| Size (word) | Frequency | Q | 5 | △ Word clouds are inherently rank 5 for Q, but they're a recognized *gist* visualization, not precise comparison. We pair them with the theme river for comparable encoding. |
| Hue (word) | Mean tone | Q (bipolar) | 4 | ✓ Acceptable: tone is a soft secondary signal. |
| Position-x (theme river) | Hour of day | T | 1 | ✓ |
| Position-y (stacked offset) | Theme count | Q | 2 (length) | ✓ Silhouette stacking optimizes for *shape* legibility. |

### Encoding-audit conclusion

No quantitative attribute carries its primary signal on a rank ≥ 3 channel.
Where rank-4/5 channels appear (color in heatmap/correlation matrix, size in
word cloud), they are explicitly secondary or paired with a position-based
fallback (tabular cell value, theme-river stacked bar).

---

## 4. Munzner what/why/how validation

For each view we restate the Munzner triple to confirm the design is
internally consistent:

### Macro

- **What** — daily BTC OHLCV (T, Q×5), GDELT daily signals (T, Q, themes), equities (T, Q×N).
- **Why** — *Discover* trends, *summarize* regimes, *identify outliers*; *select* a window.
- **How** — line + area + brush, calendar heatmap, horizon graph, event diamonds.
- **Validation** — All abstractions match: time series → position-x; outlier detection → diamond markers + heatmap saturation; brushing → standard d3 SVG pattern.

### Meso

- **What** — daily feature vectors (Q×7) + UMAP 2-D embedding + cluster ids (C).
- **Why** — *Compare* regimes, *identify* the regime of a selected day, *characterize* feature signatures.
- **How** — scatter + hulls + density splat (overview); parallel coords + SPLOM (compare); regime summary table + correlation matrix (deepen).
- **Validation** — Cluster identity uses hue (rank 1 for C); features use position (rank 1 for Q). Linked highlighting threads `selectedCluster` and `selectedDate` end-to-end.

### Micro

- **What** — intraday OHLCV for a selected date (T, Q×5), per-day GDELT events list with tone + theme.
- **Why** — *Locate* event-context for a single day, *compare* candle direction with news tone.
- **How** — 3-grid ECharts (candlestick / volume / news intensity), word cloud, theme river.
- **Validation** — Each panel shares the same x-axis (time-of-day) so reading top-to-bottom answers "what happened in price + volume + news at hour H?".

---

## 5. Known residual issues + mitigations

| ID | Issue | Severity | Plan |
|---|---|---|---|
| L1 | GDELT historical coverage is a recent-window snapshot. Older case-study windows show empty headlines. | 2 | Documented in `docs/DATA_AND_APIS.md`; UI shows explanatory copy (H9 above). |
| L2 | Polymarket data is a non-historical snapshot only. | 2 | Out of scope; tagged "Snapshot" in the provenance strip. |
| L3 | No color-blindness verification beyond ColorBrewer's CB-safe ramps. | 2 | Defer to a follow-up A/B test with `prefers-color-scheme` overlays. |
| L4 | Mobile / narrow-viewport layouts collapse but are not optimized. | 2 | Demo target is laptop / projector; flagged for v2. |

---

## 6. Severity histogram (pre- vs. post-P1–P7)

```
Severity | Pre  | Post
---------|------|-----
   4     |  0   |  0
   3     |  4   |  0
   2     |  6   |  3 (all are deferred residuals R1–R3 / L1–L4)
   1     |  3   |  4
```

All severity-3 issues (the ones that *block task completion*) were resolved
during P1–P7. Remaining severity-2 items are documentation-tagged and do
not affect the five core user-study tasks.

---

*Last updated: end of P7. Next refresh after the n=4–5 user study completes
(see `USER_STUDY_PROTOCOL.md`).*
