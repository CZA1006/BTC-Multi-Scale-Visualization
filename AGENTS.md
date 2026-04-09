# AGENTS.md

This file is the working contract for Codex / agent-assisted development inside this repo.

## Project goal
Build a web-based, coordinated multi-view Bitcoin visual analytics system covering 2019-01-01 to 2026-04-30.

## Primary analytical tasks
1. Understand long-term BTC evolution and volatility
2. Discover typical and abnormal daily market patterns
3. Drill down into selected extreme days
4. Relate BTC movements to external signals and narratives

## Product structure
### 1. Macro Overview
- Long-term BTC timeline
- Calendar heatmap
- Event overlays
- Time brush

### 2. Meso Pattern View
- UMAP / t-SNE scatterplot for daily market states
- Cluster brushing

### 3. Meso Feature Explanation
- Parallel coordinates for cluster profile comparison

### 4. Micro Detail View
- Selected-day intraday chart
- Volume
- Headline / event panel
- Optional Polymarket context

### 5. Event Context & Backtracking
- Narrative explanation for selected day
- Highlight selected date back in Macro and Meso

## Non-negotiable design principles
- Overview first
- Zoom and filter
- Details on demand
- Eyes beat memory
- Keep the main workflow stable: Macro -> Meso -> Micro -> Context

## Scope control
### Must-have
- BTC daily timeline
- Calendar heatmap
- Daily feature table
- UMAP / t-SNE result
- Parallel coordinates
- Selected-day detail
- Basic linked interaction

### Nice-to-have
- Full GDELT theme engineering
- Deep Polymarket integration
- Correlation matrix panel
- Advanced event icons and annotation polish

## Coding rules for Codex
1. Prefer small, reviewable commits.
2. Do not introduce a database unless asked.
3. Use local CSV / JSON / Parquet as the default data layer.
4. Keep API contracts explicit and typed.
5. Do not build all panels at once. Start with Macro skeleton, then Meso, then Micro.
6. Every view must render with placeholder data before real data is wired in.
7. Avoid overengineering. This is a course project, not a production SaaS platform.

## Suggested build order
1. Backend scaffolding and data scripts
2. BTC + assets ingestion with yfinance
3. Daily feature engineering
4. Macro page
5. Meso page
6. Micro page
7. Cross-view linking
8. GDELT integration
9. Polymarket integration
10. Styling and presentation polish

## Done criteria for MVP
- User can brush a time range in Macro
- Meso updates to the selected range
- User can select a point / cluster in Meso
- Micro updates to a selected day
- Basic event context loads for the selected day
