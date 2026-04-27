# Visual Encoding Reference

This document is the **data-visualization-craft** companion to
`USER_GUIDE.md`. Where the user guide tells participants *what to click*,
this file tells reviewers *why each chart looks the way it does*. Every
encoding decision is justified against three lenses:

- **Munzner** — what / why / how (the nested model).
- **Mackinlay (1986)** — effectiveness ranking of visual variables.
- **Bertin (1967) + Cleveland & McGill (1984)** — perceptual ordering of
  visual marks.

Where useful we also cite **Heer & Bostock (horizon graphs)**,
**Inselberg (parallel coordinates)**, **Tukey (SPLOM)**,
**Havre et al. (ThemeRiver)**, and **Segel & Heer (martini-glass
narratives)**, plus the Bloomberg-terminal information-density patterns
that informed the P6 craft pass.

---

## 1. Global design tokens

| Token | Value | Rationale |
|---|---|---|
| `--bg` | `#0b0d12` | Near-black canvas; maximizes contrast for color-encoded marks. Used by Bloomberg, FT Markets, TradingView dark theme. |
| `--panel` | `#11151c` | One step above bg so panel boundaries read without borders. |
| `--ink` | `#e6ecf2` | Off-white body text; AAA contrast on `--bg`. |
| `--muted` | `#8a93a6` | Secondary text + axis labels — Bertin "value" decreased to push axis to background. |
| `--pos` | `#2ca02c` (green) | Western finance convention (gain). ColorBrewer-safe. |
| `--neg` | `#d62728` (red) | Western finance convention (loss). |
| `--accent` | `#f7931a` (BTC orange) | Reserved for BTC-only marks; never used for clusters or events to avoid double-encoding. |
| `--gridline` opacity | `0.55` | Heer & Bostock's "weak grid" — visible enough to read values, faint enough to recede. |

### Color discipline

1. **One semantic per hue.** Green/red mean *return sign* everywhere
   (KPI delta chips, candlesticks, heatmap, horizon, correlation matrix).
   They never encode cluster membership.
2. **Cluster palette** is `d3.schemeSet2` with the orange entry skipped
   so it can never collide with the BTC accent.
3. **Diverging scales** (heatmap, correlation matrix) use ColorBrewer
   `RdYlGn` 7-step, anchored at zero — not min/max — so the neutral band
   keeps its meaning across windows.

---

## 2. Per-chart encoding audit

### 2.1 KPI Ticker (P6)

| | |
|---|---|
| **What** | Six scalar time-series + their latest value. |
| **Why** | At-a-glance situational awareness — the "above the fold" summary every Bloomberg-style desk has. |
| **How** | Tabular numeric → quantitative position via Mackinlay rank #1; hue → sign of delta (Mackinlay #6 for ordered nominal); inline 60-pt sparkline → trend without axis chrome. |

- **Sparkline rationale (Tufte, Edward, *Beautiful Evidence*, 2006).**
  A 60×16 px micro-line with no axes occupies ~1/40 the area of a full
  panel but resolves the *shape* (rising / falling / volatile) at the
  same accuracy because we only ask the reader to do *position* judgments.
- **Delta chip** uses ▲ / ▼ + colored numeral. Redundant encoding
  (shape + hue) protects against red-green deuteranopia.
- **Why six and not twelve?** Miller's 7±2; a 6-card row stays under
  working-memory limits.

### 2.2 Macro: BTC timeline + horizon graph (P3)

| | |
|---|---|
| **What** | One quantitative attribute (price) over a long ordered domain (time, ~3 yrs). Plus a derived 7d rolling return as a horizon graph. |
| **Why** | Identify broad regimes and direct the eye to anomaly weeks before drilling. |
| **How** | **Line for price** (continuous quantitative + ordered → position is Mackinlay #1). **Horizon graph for rolling return** stacks 3 mirrored bands → preserves linechart-like pattern reading at ~1/3 the vertical space (Heer, Kong, Agrawala 2009 — horizon graphs achieve the same accuracy as line charts down to ~24 px tall). |

- **Brush** is a 1-D x-axis brush — not 2-D — because the y-axis is
  derived (price) and brushing it would impose a price filter that the
  user did not ask for.
- **Event markers** use *position on a common scale* (date) + *shape*
  (▲ for FOMC, ◆ for war, ● for invasion, etc.) — shape is Mackinlay #5
  for nominal and is preferred to color here because color is already
  spent on return sign.

### 2.3 Macro: Calendar heatmap (P3)

| | |
|---|---|
| **What** | One quantitative attribute (daily return) over two ordered keys (week-of-year × day-of-week). |
| **Why** | Surfaces *seasonality* + *single-day anomalies* that line charts hide. |
| **How** | Position: row = weekday, column = ISO week → channel rank #1 for ordered. Hue: ColorBrewer RdYlGn 7-bin diverging anchored at 0. |

- **Why bin into 7 steps and not a continuous gradient?** Cleveland &
  McGill: humans can reliably discriminate ~7 luminance steps; more
  steps create false precision and harder mental anchoring.
- **Row order = Mon → Sun** so weekends fall together — supports the
  comparison "do crashes happen on weekends?" without re-sorting.

### 2.4 Meso: UMAP scatter + density splat + hulls (P4–P5)

| | |
|---|---|
| **What** | Each mark is one BTC trading day projected from a 14-D feature space → 2-D. |
| **Why** | Pattern discovery: similar trading days should cluster spatially. |
| **How** | Mark = filled circle (point — Bertin). Position (x, y) = quantitative → Mackinlay #1. Hue = nominal cluster id from `KMeans(k=5)`. Density underlay = `d3.contourDensity` to make the local mass legible even when points overlap (Tufte's "small multiples of the same data"). Convex hulls drawn at α = 0.18 + centroid label confirm cluster membership without re-firing the legend. |

- **Why a density splat *behind* points and not just dots?** When the
  scatter has > 1 000 marks the over-plotting destroys the very signal
  it is meant to show. The contour fixes that without abandoning the
  per-day mark (we still need to click each day).
- **Why convex hulls and not concave / α-shapes?** A reviewer has 3
  seconds to read each cluster boundary; convex is over-inclusive but
  *unambiguous*. A concave hull with concave dimples introduces
  ink-to-noise that doesn't earn its complexity.

### 2.5 Meso: Cluster summary table (P6)

| | |
|---|---|
| **What** | One row per cluster: id swatch, n, mean return, mean σ, equity-curve sparkline. |
| **Why** | Bloomberg-style numeric reference: *quantify* what the scatter only suggests. |
| **How** | Tabular numerics + small-multiples sparklines (Tufte). Equity-curve sparkline = `cumprod(1 + r)` — preserves compounding, which a mean-of-returns hides. Dashed baseline at `index = 1`. |

### 2.6 Meso: 4×4 correlation matrix (P6)

| | |
|---|---|
| **What** | Pearson correlation between BTC, COIN, MSTR, QQQ daily returns over the active window. |
| **Why** | "Is BTC moving with equities right now?" — a one-glance answer. |
| **How** | Heatmap of a 4×4 symmetric matrix. Two-stop interpolator: `#1a2335 → #2ca02c` for ρ > 0, `#1a2335 → #d62728` for ρ < 0. Numeric ρ printed inside each cell — redundant encoding (hue + text) for accessibility. Diagonal is muted (ρ = 1 by definition, no information). |

### 2.7 Meso: Parallel coordinates + SPLOM (P3)

| | |
|---|---|
| **What** | 6 engineered features per day, viewed as either polylines (PC) or pair-wise scatter cells (SPLOM). |
| **Why** | Decompose the UMAP — *which features* drive cluster separation? |
| **How** | PC: each axis is independently min-max scaled; lines colored by cluster; muted gridlines (0.55 opacity) to avoid drowning the signal (Inselberg). SPLOM: lower-triangle only — Tukey's original advice; the upper triangle would just be transposed duplicates. |

### 2.8 Micro: 3-grid ECharts candlestick (P3)

| | |
|---|---|
| **What** | OHLC + volume + GDELT bars for one selected day. |
| **Why** | The most fine-grained scale we render — confirm/refute the macro story. |
| **How** | Three stacked grids share an x-axis (time). Top = candlestick (open/close/high/low → 4-D position on common scale, the canonical financial chart since 1755 — Munehisa Homma rice exchanges). Mid = volume bars (length on common scale, Mackinlay #1). Bottom = GDELT count bars (same channel, different attribute). |

- **Shared x-axis** is essential — alignment is what lets the eye match
  a price spike to a volume spike to a news spike. Three separate
  panels would force *position-judgment-after-memorization* (Cleveland
  & McGill rank #4) instead of *aligned position* (rank #1).

### 2.9 Micro: Word cloud (P3)

| | |
|---|---|
| **What** | Per-day GDELT headline tokens, sized by frequency. |
| **Why** | Fast theme spotting; the visual answer to "what was the news about?". |
| **How** | `d3-cloud` lays out by frequency-driven font size. Position (Archimedean spiral) is **not** an encoding — only size is. Color = ColorBrewer Set2 nominal palette assigned per token hash. |

- **Why word clouds are usually bad and yet OK here.** The classic
  critique (Viégas & Wattenberg) is that word clouds compare
  *area-of-text* — channel rank ~#7 for length. We accept that loss
  because the *task* here is *recognition*, not *quantitative
  comparison*; the matched theme river to the right does the
  quantitative work.

### 2.10 Micro: Theme river (P3)

| | |
|---|---|
| **What** | Stacked area of 5 theme buckets (war / regulation / crypto / election / other) over the day. |
| **Why** | "Did the news lean *war* in the morning and *regulation* in the afternoon?" |
| **How** | `d3.stack().offset(stackOffsetSilhouette)` (Havre et al. 2002 ThemeRiver) — symmetric around y = 0, so the eye reads *thickness* (length on common axis) instead of *top edge*, which is the wrong channel for additive aggregates. `curveBasis` smooths the noise without inventing data. |

### 2.11 Micro: Asset context strip + Polymarket cards (P3, P8)

| | |
|---|---|
| **What** | 4 sparklines (BTC/COIN/MSTR/QQQ) + up-to-8 historical Polymarket cards for the selected date. |
| **Why** | Anchors the day in a wider expectation frame. The Polymarket cards answer *"what did the crowd believe on that day?"*, not *"what does the crowd believe today?"* — a strict P8 upgrade. |
| **How** | Asset sparklines: same justification as §2.1. Polymarket cards: tabular percent (Mackinlay #1 for quantitative) + 140×32 sparkline of the market's daily YES price (Tufte). The selected date is marked by a hairline + filled dot at the closest data point — a **focus mark** in a small multiple, supporting before/after comparison without panning. |

**Why a sparkline-with-marker instead of a single bar?** A bar would
collapse the time series into a scalar, but the analytic question is
*how did expectations evolve into and out of this day?*. The sparkline
preserves the trajectory while staying inside a 32-px row, and the
marker provides position-on-common-scale for the focal date — the
highest-accuracy channel (Cleveland & McGill).

**Color discipline.** Green when YES ≥ 0.5, red when YES < 0.5 — the
same return-sign convention used everywhere. The sparkline never uses
green/red to encode market identity (which is a nominal attribute);
identity is conveyed by the question text + theme tag.

**Why we cap at 8 markets.** Iran 2026 has 41 raw markets in the
curated bucket, most with ≤$1k volume. Cleveland's "small multiples"
work fails when each multiple is below the perception floor; we drop
markets below $1k 24h volume and rank by volume desc.

---

## 3. Narrative overlay (P5)

**Pattern:** Segel & Heer's *martini-glass* (2010) — start guided, end
free.

- **Steps** are author-curated: each `narratives.js` step sets a window,
  optionally a date / cluster, and a spotlit view.
- **Spotlight** uses an outside `box-shadow` to dim non-spotlit views by
  ~70 % — directs attention without removing context (the rejected
  alternative was hiding the other views, which broke the multi-scale
  promise).
- **Keys** ←/→ for next/prev, Esc to dismiss — zero-mouse story flow
  for live demos.

---

## 4. Insight log (P7)

The pin-button + slide-in panel is itself an evaluation artifact. From
a viz-craft standpoint:

- **Pinning is non-destructive.** The dashboard state is captured by
  *value*, not by *reference*, so restoring an insight does not erase
  later interactions — Nielsen "user control & freedom".
- **The export schema** (see `INSIGHT_LOG.md`) is `view + range + date +
  cluster + note` — exactly the four-tuple that defines a coordinated
  multi-view state, and therefore the minimum reproducible context.

---

## 5. What we deliberately *did not* do

| Tempting feature | Why we skipped it |
|---|---|
| 3-D scatter for the UMAP | Adds an unconstrained DOF; perspective destroys position-on-common-scale (Munzner *Visualization Analysis & Design* §6.6). |
| Pie chart of cluster sizes | Angle judgment ranks below length (Cleveland & McGill); the cluster summary table's `n` column is strictly better. |
| Animated transitions on every brush | Heer & Robertson 2007 — animation helps when objects *persist*; rapid brushes spawn / kill marks, so animation becomes noise. |
| Per-cluster custom color picker | Doubles the legend's cognitive load; nominal palettes should be fixed (Bertin). |
| A "dark/light" toggle | Light mode would force re-tuning every diverging scale; not worth a 2× design surface for a course demo. |

---

## 6. References

1. **Munzner, T.** *Visualization Analysis and Design.* CRC Press, 2014.
2. **Mackinlay, J.** "Automating the design of graphical presentations of relational information." *ACM TOG*, 1986.
3. **Bertin, J.** *Sémiologie graphique.* Mouton/Gauthier-Villars, 1967.
4. **Cleveland, W. S. & McGill, R.** "Graphical perception." *JASA*, 1984.
5. **Heer, J., Kong, N., Agrawala, M.** "Sizing the horizon." *CHI*, 2009.
6. **Havre, S., Hetzler, B., Nowell, L.** "ThemeRiver." *InfoVis*, 2000.
7. **Inselberg, A.** *Parallel Coordinates.* Springer, 2009.
8. **Segel, E. & Heer, J.** "Narrative Visualization." *IEEE TVCG*, 2010.
9. **Tukey, J. W.** *Exploratory Data Analysis.* Addison-Wesley, 1977.
10. **Tufte, E.** *Beautiful Evidence.* Graphics Press, 2006.
11. **Viégas, F. & Wattenberg, M.** "TIMELINES: Tag clouds and the case for vernacular visualization." *interactions*, 2008.
12. **Nielsen, J.** "Why You Only Need to Test with 5 Users." *NN/g*, 2000.

---

*Last updated: end of P7. Companion to `USER_GUIDE.md` (how) and
`HEURISTIC_EVALUATION.md` (where it falls short).*
