import React, { useEffect, useState } from 'react';
import { MacroView } from './views/MacroView.jsx';
import { MesoView } from './views/MesoView.jsx';
import { MicroView } from './views/MicroView.jsx';
import { useAppStore } from './store/useAppStore.js';
import { SpotlightHighlight } from './components/SpotlightHighlight.jsx';

const CASE_STUDIES = [
  {
    title: 'COVID Shock',
    description: 'Panic, crash, and rebound around the early pandemic window.',
    range: { start: '2020-02-01', end: '2020-06-30' },
  },
  {
    title: 'War Regime',
    description: 'Russia-Ukraine war window for macro stress and volatility.',
    range: { start: '2022-02-01', end: '2022-05-31' },
  },
  {
    title: 'Election Cycle',
    description: 'U.S. election narrative window with crypto-policy attention.',
    range: { start: '2024-09-01', end: '2025-01-31' },
  },
  {
    title: 'Iran Tension',
    description: 'Recent Middle East tension window for event-context demos.',
    range: { start: '2026-03-01', end: '2026-04-30' },
  },
];

const QUICK_NAV_ITEMS = [
  { id: 'view1', label: 'Macro' },
  { id: 'view2', label: 'Meso' },
  { id: 'view3', label: 'Micro' },
];

export default function App() {
  const selectedTimeRange = useAppStore((state) => state.selectedTimeRange);
  const setSelectedTimeRange = useAppStore((state) => state.setSelectedTimeRange);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const setSelectedCluster = useAppStore((state) => state.setSelectedCluster);
  const [activeViewId, setActiveViewId] = useState('view1');

  function applyCaseStudy(study) {
    setSelectedTimeRange(study.range);
    setSelectedDate(null);
    setSelectedCluster(null);
  }

  function scrollToView(viewId) {
    const target = document.getElementById(viewId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  useEffect(() => {
    const targets = QUICK_NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (targets.length === 0) return undefined;

    function updateActiveViewByViewport() {
      const viewportAnchor = window.innerHeight * 0.45;
      const closest = targets.reduce(
        (best, element) => {
          const rect = element.getBoundingClientRect();
          const sectionAnchor = rect.top + rect.height / 2;
          const distance = Math.abs(sectionAnchor - viewportAnchor);
          if (distance < best.distance) {
            return { id: element.id, distance };
          }
          return best;
        },
        { id: targets[0].id, distance: Number.POSITIVE_INFINITY },
      );
      setActiveViewId(closest.id);
    }

    updateActiveViewByViewport();
    window.addEventListener('scroll', updateActiveViewByViewport, { passive: true });
    window.addEventListener('resize', updateActiveViewByViewport);
    return () => {
      window.removeEventListener('scroll', updateActiveViewByViewport);
      window.removeEventListener('resize', updateActiveViewByViewport);
    };
  }, []);

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
      </header>

      <section className="story-strip">
        <div className="story-strip-header">
          <div>
            <h2 className="story-strip-title">Case-Study Navigator</h2>
          </div>
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

      <section className="dashboard-stack">
        <SpotlightHighlight viewId="macro">
          <div id="view1" className="dashboard-section">
            <MacroView />
          </div>
        </SpotlightHighlight>
        <SpotlightHighlight viewId="meso">
          <div id="view2" className="dashboard-section">
            <MesoView />
          </div>
        </SpotlightHighlight>
        <SpotlightHighlight viewId="micro">
          <div id="view3" className="dashboard-section">
            <MicroView />
          </div>
        </SpotlightHighlight>
      </section>

      <aside className="quick-nav" aria-label="Quick view navigation">
        <span className="quick-nav-title" aria-hidden="true">
          Navigate
        </span>
        {QUICK_NAV_ITEMS.map((item, index) => {
          const isActive = activeViewId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? 'quick-nav-button quick-nav-button-active' : 'quick-nav-button'}
              onClick={() => scrollToView(item.id)}
              aria-label={`Jump to ${item.label} view`}
            >
              <span className="quick-nav-dot" aria-hidden="true">
                {index + 1}
              </span>
              <span className="quick-nav-label">{item.label}</span>
            </button>
          );
        })}
      </aside>
    </main>
  );
}
