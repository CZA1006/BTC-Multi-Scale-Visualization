import { create } from 'zustand';

// Round-1 shared state for coordinating the Macro, Meso, and Micro views.
// P5 additions: narrative slice for martini-glass guided sequences.
//   narrativeMode = 'idle' | 'playing' | 'released'
// P7 additions: insight log slice — pin contextual observations to a localStorage
// list, restore them later, export as JSON. Designed to double as the artifact
// produced by user-study participants.
// Existing slices (selectedTimeRange/Date/Cluster) are unchanged — narrative
// setters delegate to them so views observe normal state changes.

const INSIGHTS_STORAGE_KEY = 'btc-multi-scale.insights.v1';

function loadInsights() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INSIGHTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistInsights(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage may be disabled (private mode, quota); fail silently.
  }
}

function makeInsightId() {
  return `ins_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
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

  // ---------- P7: insight log slice ----------
  insights: loadInsights(),
  insightDraft: null,        // { view, range, date, cluster } when modal is open
  insightPanelOpen: false,

  openInsightDraft: (view) => {
    const { selectedTimeRange, selectedDate, selectedCluster } = get();
    set({
      insightDraft: {
        view: view ?? null,
        range: selectedTimeRange ?? null,
        date: selectedDate ?? null,
        cluster: selectedCluster ?? null,
      },
    });
  },

  cancelInsightDraft: () => set({ insightDraft: null }),

  saveInsightDraft: (note) => {
    const { insightDraft, insights } = get();
    if (!insightDraft) return;
    const trimmed = String(note ?? '').trim();
    if (!trimmed) {
      set({ insightDraft: null });
      return;
    }
    const entry = {
      id: makeInsightId(),
      createdAt: new Date().toISOString(),
      view: insightDraft.view,
      range: insightDraft.range,
      date: insightDraft.date,
      cluster: insightDraft.cluster,
      note: trimmed,
    };
    const next = [entry, ...insights];
    persistInsights(next);
    set({ insights: next, insightDraft: null });
  },

  removeInsight: (id) => {
    const { insights } = get();
    const next = insights.filter((entry) => entry.id !== id);
    persistInsights(next);
    set({ insights: next });
  },

  clearInsights: () => {
    persistInsights([]);
    set({ insights: [] });
  },

  toggleInsightPanel: () =>
    set((state) => ({ insightPanelOpen: !state.insightPanelOpen })),

  closeInsightPanel: () => set({ insightPanelOpen: false }),

  // Restore the captured context of a pinned insight back into live state.
  restoreInsight: (id) => {
    const { insights } = get();
    const entry = insights.find((e) => e.id === id);
    if (!entry) return;
    set({
      selectedTimeRange: entry.range ?? null,
      selectedDate: entry.date ?? null,
      selectedCluster: entry.cluster ?? null,
    });
  },
}));
