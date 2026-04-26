import React from 'react';
import { useAppStore } from '../store/useAppStore.js';

// Small ghost button rendered in each view's header. Captures live context
// (selectedTimeRange / selectedDate / selectedCluster) and the originating
// view, then opens the insight draft modal.
export function PinInsightButton({ view }) {
  const openInsightDraft = useAppStore((s) => s.openInsightDraft);
  return (
    <button
      type="button"
      className="insight-pin-btn"
      onClick={() => openInsightDraft(view)}
      title="Pin an insight from this view"
      aria-label="Pin insight"
    >
      <span aria-hidden="true">📌</span>
      <span>Pin insight</span>
    </button>
  );
}
