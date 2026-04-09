# Demo Script

## Goal
Use this script for the final presentation demo of the coordinated BTC visual analytics system.

Recommended total demo time:
- `5` to `8` minutes

## Before the demo
1. Start the backend.
2. Start the frontend.
3. Make sure the dashboard loads without API errors.
4. Preload recent GDELT and Polymarket context if needed:
   - `python3 backend/scripts/fetch_gdelt_context.py --days 14`
   - `python3 backend/scripts/fetch_polymarket_context.py`

## Opening
Suggested message:

> This system is designed to analyze Bitcoin across three coordinated scales.  
> We start with the full-period macro view, move into meso-level daily market states, then drill into one selected day with event and market-context explanations.

## Step 1 — Show the dashboard structure
Point out:
- `Case-Study Navigator`
- `Global status strip`
- `Macro Overview`
- `Meso Pattern View`
- `Micro Detail View`

Suggested message:

> The workflow is stable and top-down: Macro for time navigation, Meso for pattern discovery, and Micro for selected-day explanation.

## Step 2 — Use Macro to explain the long-term picture
Use:
- BTC timeline
- time brush
- calendar heatmap
- event overlay markers

Suggested actions:
1. Start in `Full Range`
2. Drag the timeline brush to a narrower period
3. Click one event marker on the timeline
4. Click one heatmap cell

Suggested message:

> In Macro, we first identify broad market regimes, then use event markers and the calendar structure to locate days with unusually dense narrative activity.

## Step 3 — Move into Meso
Use:
- scatterplot
- cluster selector
- parallel coordinates

Suggested actions:
1. Select one cluster from the scatterplot or cluster buttons
2. Show how the parallel-coordinates profile changes
3. Click one point to select a day

Suggested message:

> In Meso, each point is one BTC trading day embedded from engineered features.  
> Nearby points represent similar market states, and the parallel-coordinates plot helps explain what makes each cluster distinct.

## Step 4 — Drill into Micro
Use:
- selected-day chart
- narrative summary
- GDELT headline panel
- Polymarket context panel

Suggested actions:
1. Let the selected date propagate from Macro or Meso
2. Show the detail chart
3. Read one or two headlines
4. Show the Polymarket cards as expectation context

Suggested message:

> In Micro, we explain one day in detail through price behavior, narrative context, and a small market-expectation layer from Polymarket.

## Recommended case studies

### 1. COVID Shock
Window:
- `2020-02-01` to `2020-06-30`

What to emphasize:
- rapid regime shift
- volatility expansion
- cluster separation
- no full GDELT history yet, so focus more on price structure

### 2. Election Cycle
Window:
- `2024-09-01` to `2025-01-31`

What to emphasize:
- policy and regulation framing
- relationship between BTC state clusters and macro narrative
- use Macro -> Meso -> Micro linking

### 3. Iran Tension
Window:
- `2026-03-01` to `2026-04-09`

What to emphasize:
- this is the strongest current live-demo window
- GDELT headlines are available
- event overlays, headlines, and Polymarket are easiest to demonstrate here

## If something fails during the demo

### If GDELT headlines are missing
Say:

> The GDELT selected-day panel is implemented, but recent API availability can vary.  
> The fallback narrative and local context still keep the selected-day analysis usable.

### If Polymarket data is missing
Say:

> The Polymarket layer is currently a minimal live snapshot.  
> It is included as expectation context rather than a full historical signal.

### If a selected day has no intraday data
Say:

> Intraday data availability depends on provider limits, so the system falls back to a local daily context window.

## Closing message

> The contribution of this project is not just one chart, but the coordinated flow across time navigation, market-state discovery, and selected-day explanation.  
> The system helps move from overview to insight with linked interactions and external context.
