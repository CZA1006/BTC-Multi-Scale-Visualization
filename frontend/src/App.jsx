import React from 'react';
import { MacroView } from './views/MacroView.jsx';
import { MesoView } from './views/MesoView.jsx';
import { MicroView } from './views/MicroView.jsx';
import { useAppStore } from './store/useAppStore.js';
import { getClusterSemanticLabel } from './utils/clusterLabels.js';
import { NARRATIVES } from './data/narratives.js';
import { NarrativeOverlay } from './components/NarrativeOverlay.jsx';
import { SpotlightHighlight } from './components/SpotlightHighlight.jsx';
import { KpiTicker } from './components/KpiTicker.jsx';
import { InsightDraftModal } from './components/InsightDraftModal.jsx';
import { InsightLogPanel } from './components/InsightLogPanel.jsx';

const DATA_PROVENANCE = [
  {
    source: 'BTC OHLCV',
    meta: 'yfinance · 2019-01 → today · daily',
    status: 'Cached',
    statusClass: 'provenance-status-cached',
  },
  {
    source: 'Equities',
    meta: 'yfinance · COIN, MSTR, QQQ · daily',
    status: 'Cached',
    statusClass: 'provenance-status-cached',
  },
  {
    source: 'GDELT News',
    meta: 'DOC API · rolling 60-day window',
    status: 'Live',
    statusClass: 'provenance-status-live',
  },
  {
    source: 'Polymarket',
    meta: 'Gamma API · snapshot (non-historical)',
    status: 'Snapshot',
    statusClass: 'provenance-status-snapshot',
  },
];

const CASE_STUDIES = [
  {
    title: 'COVID Shock',
    description: 'Panic, crash, and rebound around the early pandemic window.',
    range: { start: '2020-02-01', end: '2020-06-30' },
    narrativeId: 'covid',
  },
  {
    title: 'War Regime',
    description: 'Russia-Ukraine war window for macro stress and volatility.',
    range: { start: '2022-02-01', end: '2022-05-31' },
    narrativeId: 'war',
  },
  {
    title: 'Election Cycle',
    description: 'U.S. election narrative window with crypto-policy attention.',
    range: { start: '2024-09-01', end: '2025-01-31' },
    narrativeId: 'election',
  },
  {
    title: 'Iran Tension',
    description: 'Recent Middle East tension window for event-context demos.',
    range: { start: '2026-03-01', end: '2026-04-09' },
    narrativeId: 'iran',
  },
];

export default function App() {
  const selectedTimeRange = useAppStore((state) => state.selectedTimeRange);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const selectedCluster = useAppStore((state) => state.selectedCluster);
  const setSelectedTimeRange = useAppStore((state) => state.setSelectedTimeRange);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const setSelectedCluster = useAppStore((state) => state.setSelectedCluster);
  const setNarrative = useAppStore((state) => state.setNarrative);
  const insightCount = useAppStore((state) => state.insights.length);
  const toggleInsightPanel = useAppStore((state) => state.toggleInsightPanel);

  const activeRangeLabel = selectedTimeRange
    ? `${selectedTimeRange.start ?? 'N/A'} to ${selectedTimeRange.end ?? 'N/A'}`
    : 'No range selected';
  const activeClusterLabel =
    selectedCluster === null || selectedCluster === undefined
      ? 'No cluster selected'
      : getClusterSemanticLabel(selectedCluster);
  const activeDateLabel = selectedDate ?? 'No date selected';

  function applyCaseStudy(study) {
    if (study.narrativeId && NARRATIVES[study.narrativeId]) {
      setNarrative(NARRATIVES[study.narrativeId]);
      return;
    }
    // Fallback for case studies without an authored narrative.
    setSelectedTimeRange(study.range);
    setSelectedDate(null);
    setSelectedCluster(null);
  }

  return (
    <main className="app-shell">
      <header className="title-bar">
        <div>
          <p className="app-eyebrow">Coordinated Multi-View Dashboard</p>
          <h1 className="app-title">BTC Multi-Scale Visualization</h1>
        </div>
        <p className="app-subtitle">
          Follow the workflow from Macro to Meso to Micro: brush a window, pick a
          market regime, then drill into a selected day and its event context.
        </p>
        <button
          type="button"
          className="title-bar-insight-pill"
          onClick={toggleInsightPanel}
          aria-label="Open pinned insights panel"
        >
          <span aria-hidden="true">📌</span>
          Insights
          <span className="title-bar-insight-count">{insightCount}</span>
        </button>
      </header>

      <section className="story-strip">
        <div className="story-strip-header">
          <div>
            <p className="app-eyebrow">Presentation Mode</p>
            <h2 className="story-strip-title">Case-Study Navigator</h2>
          </div>
          <p className="story-strip-copy">
            Use these windows to move quickly between the main narrative scenarios in the
            final demo.
          </p>
        </div>

        <div className="story-card-grid">
          {CASE_STUDIES.map((study) => {
            const isActive =
              selectedTimeRange?.start === study.range.start &&
              selectedTimeRange?.end === study.range.end;

            return (
              <button
                key={study.title}
                type="button"
                className={isActive ? 'story-card story-card-active' : 'story-card'}
                onClick={() => applyCaseStudy(study)}
              >
                <span className="story-card-title">{study.title}</span>
                <span className="story-card-range">
                  {study.range.start} to {study.range.end}
                </span>
                <span className="story-card-copy">{study.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <KpiTicker />

      <section className="status-strip">
        <div className="status-pill">
          <span className="status-pill-label">Range</span>
          <strong>{activeRangeLabel}</strong>
        </div>
        <div className="status-pill">
          <span className="status-pill-label">Cluster</span>
          <strong>{activeClusterLabel}</strong>
        </div>
        <div className="status-pill">
          <span className="status-pill-label">Selected Day</span>
          <strong>{activeDateLabel}</strong>
        </div>
      </section>

      <section className="provenance-strip" aria-label="Data provenance">
        {DATA_PROVENANCE.map((item) => (
          <div key={item.source} className="provenance-chip">
            <span className="provenance-source">{item.source}</span>
            <span className="provenance-meta">{item.meta}</span>
            <span className={`provenance-status ${item.statusClass}`}>
              {item.status}
            </span>
          </div>
        ))}
      </section>

      <section className="dashboard-stack">
        <SpotlightHighlight viewId="macro">
          <div className="dashboard-section">
            <MacroView />
          </div>
        </SpotlightHighlight>
        <SpotlightHighlight viewId="meso">
          <div className="dashboard-section">
            <MesoView />
          </div>
        </SpotlightHighlight>
        <SpotlightHighlight viewId="micro">
          <div className="dashboard-section">
            <MicroView />
          </div>
        </SpotlightHighlight>
      </section>

      <NarrativeOverlay />
      <InsightDraftModal />
      <InsightLogPanel />
    </main>
  );
}
