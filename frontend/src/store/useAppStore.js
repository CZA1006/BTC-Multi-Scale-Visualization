import { create } from 'zustand';

// Round-1 shared state for coordinating the Macro, Meso, and Micro views.
export const useAppStore = create((set) => ({
  selectedTimeRange: null,
  selectedDate: null,
  selectedCluster: null,

  setSelectedTimeRange: (selectedTimeRange) => set({ selectedTimeRange }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setSelectedCluster: (selectedCluster) => set({ selectedCluster }),
}));
