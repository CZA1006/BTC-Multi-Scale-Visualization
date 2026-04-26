import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { getClusterSemanticLabel } from '../utils/clusterLabels.js';

// Captures the user's note for a pinned insight. Renders only when
// insightDraft is non-null in the store. Esc cancels, ⌘/Ctrl+Enter saves.
export function InsightDraftModal() {
  const draft = useAppStore((s) => s.insightDraft);
  const cancelInsightDraft = useAppStore((s) => s.cancelInsightDraft);
  const saveInsightDraft = useAppStore((s) => s.saveInsightDraft);

  const [note, setNote] = useState('');
  const textareaRef = useRef(null);

  // Reset note + autofocus whenever the draft transitions from closed → open.
  useEffect(() => {
    if (draft) {
      setNote('');
      // Defer focus so the modal mounts first.
      const id = window.setTimeout(() => textareaRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [draft]);

  useEffect(() => {
    if (!draft) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelInsightDraft();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveInsightDraft(note);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, note, cancelInsightDraft, saveInsightDraft]);

  if (!draft) return null;

  const rangeLabel = draft.range
    ? `${draft.range.start ?? '—'} → ${draft.range.end ?? '—'}`
    : 'No range';
  const clusterLabel =
    draft.cluster === null || draft.cluster === undefined
      ? 'No cluster'
      : getClusterSemanticLabel(draft.cluster);
  const dateLabel = draft.date ?? 'No date selected';
  const viewLabel = draft.view ? draft.view.toUpperCase() : '—';

  const canSave = note.trim().length > 0;

  return (
    <div className="insight-draft-backdrop" onClick={cancelInsightDraft}>
      <div
        className="insight-draft-modal"
        role="dialog"
        aria-label="Pin a new insight"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="insight-draft-header">
          <p className="app-eyebrow">Insight Log</p>
          <h3 className="insight-draft-title">Pin a new insight</h3>
        </header>

        <div className="insight-draft-context">
          <span className="insight-context-chip">View · {viewLabel}</span>
          <span className="insight-context-chip">Range · {rangeLabel}</span>
          <span className="insight-context-chip">Date · {dateLabel}</span>
          <span className="insight-context-chip">Cluster · {clusterLabel}</span>
        </div>

        <label className="insight-draft-label" htmlFor="insight-draft-textarea">
          Observation
        </label>
        <textarea
          id="insight-draft-textarea"
          ref={textareaRef}
          className="insight-draft-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you notice? e.g. 'Black Thursday volume spike coincides with regulation theme dominating the word cloud.'"
          rows={4}
        />

        <div className="insight-draft-actions">
          <button
            type="button"
            className="range-button"
            onClick={cancelInsightDraft}
          >
            Cancel
          </button>
          <button
            type="button"
            className="range-button range-button-active"
            onClick={() => saveInsightDraft(note)}
            disabled={!canSave}
          >
            Save insight
          </button>
        </div>
        <p className="insight-draft-hint">
          Shortcuts: Esc cancel · ⌘/Ctrl + Enter save
        </p>
      </div>
    </div>
  );
}
