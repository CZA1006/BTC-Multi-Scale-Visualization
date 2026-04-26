import React, { forwardRef } from 'react';
import { useAppStore } from '../store/useAppStore.js';

// Wraps a view and adds a glowing ring when the active narrative step
// targets this viewId. No layout shift — purely a box-shadow change.
export const SpotlightHighlight = forwardRef(function SpotlightHighlight(
  { viewId, children },
  ref,
) {
  const narrative = useAppStore((s) => s.narrative);
  const narrativeStep = useAppStore((s) => s.narrativeStep);
  const narrativeMode = useAppStore((s) => s.narrativeMode);

  const activeStep =
    narrativeMode === 'playing' && narrative ? narrative.steps[narrativeStep] : null;
  const isSpotlit = activeStep && activeStep.spotlight === viewId;

  return (
    <div
      ref={ref}
      className={isSpotlit ? 'spotlight spotlight-active' : 'spotlight'}
      data-view-id={viewId}
    >
      {children}
    </div>
  );
});
