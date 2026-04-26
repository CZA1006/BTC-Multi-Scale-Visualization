import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';

export function NarrativeOverlay() {
  const narrative = useAppStore((s) => s.narrative);
  const narrativeStep = useAppStore((s) => s.narrativeStep);
  const narrativeMode = useAppStore((s) => s.narrativeMode);
  const advanceNarrative = useAppStore((s) => s.advanceNarrative);
  const rewindNarrative = useAppStore((s) => s.rewindNarrative);
  const exitNarrative = useAppStore((s) => s.exitNarrative);

  // Keyboard shortcuts: → / Space advance, ← back, Esc exit.
  useEffect(() => {
    if (narrativeMode !== 'playing' || !narrative) return undefined;
    function onKey(e) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        advanceNarrative();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        rewindNarrative();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitNarrative();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [narrativeMode, narrative, advanceNarrative, rewindNarrative, exitNarrative]);

  // Auto-scroll spotlight target into view when step changes.
  useEffect(() => {
    if (narrativeMode !== 'playing' || !narrative) return;
    const step = narrative.steps[narrativeStep];
    if (!step?.spotlight) return;
    const target = document.querySelector(`[data-view-id="${step.spotlight}"]`);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [narrativeMode, narrative, narrativeStep]);

  if (narrativeMode !== 'playing' || !narrative) return null;

  const step = narrative.steps[narrativeStep];
  const total = narrative.steps.length;
  const isLast = narrativeStep === total - 1;

  return (
    <aside className="narrative-overlay" role="dialog" aria-label={`Narrative: ${narrative.title}`}>
      <div className="narrative-overlay-header">
        <div className="narrative-step-pips" aria-hidden="true">
          {narrative.steps.map((s, i) => (
            <span
              key={s.id}
              className={
                i < narrativeStep
                  ? 'narrative-step-pip narrative-step-pip-done'
                  : i === narrativeStep
                    ? 'narrative-step-pip narrative-step-pip-active'
                    : 'narrative-step-pip'
              }
            />
          ))}
        </div>
        <span className="narrative-step-label">
          Step {narrativeStep + 1} of {total} · {narrative.title}
        </span>
        <button
          type="button"
          className="narrative-exit"
          onClick={exitNarrative}
          aria-label="Exit narrative"
        >
          ✕
        </button>
      </div>
      <h4 className="narrative-step-title">{step.title}</h4>
      <p className="narrative-step-body">{step.body}</p>
      <div className="narrative-overlay-actions">
        <button
          type="button"
          className="range-button"
          onClick={rewindNarrative}
          disabled={narrativeStep === 0}
        >
          ← Back
        </button>
        <button
          type="button"
          className="range-button range-button-active"
          onClick={advanceNarrative}
        >
          {isLast ? 'Begin free exploration →' : 'Next →'}
        </button>
      </div>
      <p className="narrative-overlay-hint">
        Shortcuts: → next · ← back · Esc exit
      </p>
    </aside>
  );
}
