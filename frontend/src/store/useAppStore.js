import { create } from 'zustand';

// Round-1 shared state for coordinating the Macro, Meso, and Micro views.
// P5 additions: narrative slice for martini-glass guided sequences.
//   narrativeMode = 'idle' | 'playing' | 'released'
// Existing slices (selectedTimeRange/Date/Cluster) are unchanged — narrative
// setters delegate to them so views observe normal state changes.
export const useAppStore = create((set, get) => ({
  selectedTimeRange: null,
  selectedDate: null,
  selectedCluster: null,

  setSelectedTimeRange: (selectedTimeRange) => set({ selectedTimeRange }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setSelectedCluster: (selectedCluster) => set({ selectedCluster }),

  // ---------- P5: narrative slice ----------
  narrative: null,
  narrativeStep: 0,
  narrativeMode: 'idle',

  setNarrative: (narrative) => {
    if (!narrative) {
      set({ narrative: null, narrativeStep: 0, narrativeMode: 'idle' });
      return;
    }
    const step = narrative.steps?.[0];
    set({
      narrative,
      narrativeStep: 0,
      narrativeMode: 'playing',
    });
    if (step?.state) {
      const patch = {};
      if ('selectedTimeRange' in step.state) patch.selectedTimeRange = step.state.selectedTimeRange;
      if ('selectedDate' in step.state) patch.selectedDate = step.state.selectedDate;
      if ('selectedCluster' in step.state) patch.selectedCluster = step.state.selectedCluster;
      if (Object.keys(patch).length > 0) set(patch);
    }
  },

  advanceNarrative: () => {
    const { narrative, narrativeStep } = get();
    if (!narrative) return;
    const nextIndex = narrativeStep + 1;
    if (nextIndex >= narrative.steps.length) {
      // Open end of the martini glass — release to free exploration.
      set({ narrative: null, narrativeStep: 0, narrativeMode: 'released' });
      return;
    }
    const step = narrative.steps[nextIndex];
    set({ narrativeStep: nextIndex });
    if (step?.state) {
      const patch = {};
      if ('selectedTimeRange' in step.state) patch.selectedTimeRange = step.state.selectedTimeRange;
      if ('selectedDate' in step.state) patch.selectedDate = step.state.selectedDate;
      if ('selectedCluster' in step.state) patch.selectedCluster = step.state.selectedCluster;
      if (Object.keys(patch).length > 0) set(patch);
    }
  },

  rewindNarrative: () => {
    const { narrative, narrativeStep } = get();
    if (!narrative || narrativeStep === 0) return;
    const prevIndex = narrativeStep - 1;
    const step = narrative.steps[prevIndex];
    set({ narrativeStep: prevIndex });
    if (step?.state) {
      const patch = {};
      if ('selectedTimeRange' in step.state) patch.selectedTimeRange = step.state.selectedTimeRange;
      if ('selectedDate' in step.state) patch.selectedDate = step.state.selectedDate;
      if ('selectedCluster' in step.state) patch.selectedCluster = step.state.selectedCluster;
      if (Object.keys(patch).length > 0) set(patch);
    }
  },

  exitNarrative: () =>
    set({ narrative: null, narrativeStep: 0, narrativeMode: 'idle' }),
}));
