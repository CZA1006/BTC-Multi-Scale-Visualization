# Development Roadmap

## Phase 0 — Repo and scaffolding
- Create folders
- Add docs and schemas
- Decide frontend / backend structure
- Add minimal build scripts

## Phase 1 — Data ingestion
- Build yfinance fetchers for BTC and external assets
- Build GDELT filtered extraction process
- Build Polymarket history fetcher
- Write data-quality checks

## Phase 2 — Derived data
- Compute BTC daily table
- Build daily feature table
- Produce first UMAP / t-SNE
- Produce first cluster labels

## Phase 3 — Frontend MVP
### Macro
- Long-term BTC timeline
- Calendar heatmap
- Time brush
- GDELT event markers on timeline and heatmap

### Meso
- Embedding scatterplot
- Cluster brushing
- Parallel coordinates

### Micro
- Selected-day detail chart
- Headline panel
- Polymarket context panel

## Phase 4 — Linking and polish
- Macro -> Meso filtering
- Meso -> Micro selected day
- Backtracking highlights
- Basic case-study story flow

## Current status snapshot
- Phase 0 complete
- Phase 1 partially complete
  - yfinance complete
  - GDELT recent-window integration complete
  - Polymarket minimal snapshot complete
- Phase 2 complete for the current MVP feature set
- Phase 3 complete for the current MVP feature set
- Phase 4 basic linking complete, polish still pending

## Phase 5 — Enhancements
- GDELT feature enrichment
- Polymarket overlay
- Better annotations
- UI polish and presentation prep
