import React from 'react';
import { MacroView } from './views/MacroView.jsx';
import { MesoView } from './views/MesoView.jsx';
import { MicroView } from './views/MicroView.jsx';
import { useAppStore } from './store/useAppStore.js';
import { getClusterSemanticLabel } from './utils/clusterLabels.js';

const CASE_STUDIES = [
  {
    title: 'COVID Shock',
    description: 'Panic, crash, and rebound around the early pandemic window.',
    range: {
      start: '2020-02-01',
      end: '2020-06-30',
    },
  },
  {
    title: 'War Regime',
    description: 'Russia-Ukraine war window for macro stress and volatility.',
    range: {
      start: '2022-02-01',
      end: '2022-05-31',
    },
  },
  {
    title: 'Election Cycle',
    description: 'U.S. election narrative window with crypto-policy attention.',
    range: {
      start: '2024-09-01',
      end: '2025-01-31',
    },
  },
  {
    title: 'Iran Tension',
    description: 'Recent Middle East tension window for event-context demos.',
    range: {
      start: '2026-03-01',
      end: '2026-04-09',
    },
  },
];

export default function App() {
  const selectedTimeRange = useAppStore((state) => state.selectedTimeRange);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const selectedCluster = useAppStore((state) => state.selectedCluster);
  const setSelectedTimeRange = useAppStore((state) => state.setSelectedTimeRange);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const setSelectedCluster = useAppStore((state) => state.setSelectedCluster);

  const activeRangeLabel = selectedTimeRange
    ? `${selectedTimeRange.start ?? 'N/A'} to ${selectedTimeRange.end ?? 'N/A'}`
    : 'No range selected';
  const activeClusterLabel =
    selectedCluster === null || selectedCluster === undefined
      ? 'No cluster selected'
      : getClusterSemanticLabel(selectedCluster);
  const activeDateLabel = selectedDate ?? 'No date selected';

  function applyCaseStudy(range) {
    setSelectedTimeRange(range);
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
          Macro overview, meso pattern discovery, and micro detail are arranged as a
          clear vertical workflow for later D3-based views.
        </p>
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
                onClick={() => applyCaseStudy(study.range)}
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

      <section className="dashboard-stack">
        <div className="dashboard-section">
          <MacroView />
        </div>
        <div className="dashboard-section">
          <MesoView />
        </div>
        <div className="dashboard-section">
          <MicroView />
        </div>
      </section>
    </main>
  );
}
