import React from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { getClusterSemanticLabel } from '../utils/clusterLabels.js';

// Slide-in panel listing pinned insights newest-first. Each row shows captured
// context as chips, the note, and actions (restore / remove). Footer offers
// JSON export and bulk clear.
export function InsightLogPanel() {
  const insights = useAppStore((s) => s.insights);
  const isOpen = useAppStore((s) => s.insightPanelOpen);
  const closeInsightPanel = useAppStore((s) => s.closeInsightPanel);
  const removeInsight = useAppStore((s) => s.removeInsight);
  const clearInsights = useAppStore((s) => s.clearInsights);
  const restoreInsight = useAppStore((s) => s.restoreInsight);

  if (!isOpen) return null;

  function handleExport() {
    const payload = JSON.stringify(insights, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `insights-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleClearAll() {
    if (insights.length === 0) return;
    const ok = window.confirm(
      `Delete all ${insights.length} pinned insight${insights.length === 1 ? '' : 's'}? This cannot be undone.`,
    );
    if (ok) clearInsights();
  }

  return (
    <aside
      className="insight-log-panel insight-log-panel-open"
      role="complementary"
      aria-label="Pinned insights"
    >
      <header className="insight-log-header">
        <div>
          <p className="app-eyebrow">Insight Log</p>
          <h3 className="insight-log-title">
            Pinned insights ({insights.length})
          </h3>
        </div>
        <button
          type="button"
          className="narrative-exit"
          onClick={closeInsightPanel}
          aria-label="Close insight panel"
        >
          ✕
        </button>
      </header>

      {insights.length === 0 ? (
        <div className="insight-log-empty">
          <p>No insights pinned yet.</p>
          <p className="state-label">
            Use the “Pin insight” button on any view to capture an observation
            with its full context — time range, selected day, and cluster.
          </p>
        </div>
      ) : (
        <ul className="insight-log-list">
          {insights.map((entry) => {
            const rangeLabel = entry.range
              ? `${entry.range.start ?? '—'} → ${entry.range.end ?? '—'}`
              : 'No range';
            const clusterLabel =
              entry.cluster === null || entry.cluster === undefined
                ? null
                : getClusterSemanticLabel(entry.cluster);
            const ts = new Date(entry.createdAt);
            const tsLabel = Number.isNaN(ts.getTime())
              ? entry.createdAt
              : ts.toLocaleString();
            return (
              <li key={entry.id} className="insight-row">
                <div className="insight-row-header">
                  <span className="insight-row-time">{tsLabel}</span>
                  <button
                    type="button"
                    className="insight-row-remove"
                    onClick={() => removeInsight(entry.id)}
                    aria-label="Remove insight"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
                <p className="insight-row-note">{entry.note}</p>
                <div className="insight-row-context">
                  {entry.view ? (
                    <span className="insight-context-chip">
                      View · {entry.view.toUpperCase()}
                    </span>
                  ) : null}
                  <span className="insight-context-chip">Range · {rangeLabel}</span>
                  {entry.date ? (
                    <span className="insight-context-chip">Date · {entry.date}</span>
                  ) : null}
                  {clusterLabel ? (
                    <span className="insight-context-chip">
                      Cluster · {clusterLabel}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="insight-row-restore"
                  onClick={() => restoreInsight(entry.id)}
                  title="Restore this insight's range / date / cluster"
                >
                  ↻ Restore context
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="insight-log-footer">
        <button
          type="button"
          className="range-button"
          onClick={handleExport}
          disabled={insights.length === 0}
        >
          Export JSON
        </button>
        <button
          type="button"
          className="range-button"
          onClick={handleClearAll}
          disabled={insights.length === 0}
        >
          Clear all
        </button>
      </footer>
    </aside>
  );
}
