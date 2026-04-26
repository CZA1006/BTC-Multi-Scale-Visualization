import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { fetchOverview } from '../api/overview.js';

// Tiny module-scoped cache so the KPI ticker, correlation matrix, and any
// future consumer don't all re-fetch the same overview when the time range
// changes. Keyed on `${start}|${end}`. In-flight promises are also deduped so
// concurrent mounts share a single network call.
const cache = new Map();
const inflight = new Map();

const EMPTY = { btc_daily: [], external_assets_daily: [], gdelt_daily_signals: [] };

export function useOverview() {
  const selectedTimeRange = useAppStore((s) => s.selectedTimeRange);
  const key = selectedTimeRange
    ? `${selectedTimeRange.start ?? ''}|${selectedTimeRange.end ?? ''}`
    : null;

  const [state, setState] = useState(() => ({
    overview: key && cache.has(key) ? cache.get(key) : EMPTY,
    isLoading: !!key && !cache.has(key),
  }));

  useEffect(() => {
    if (!key) {
      setState({ overview: EMPTY, isLoading: false });
      return undefined;
    }
    if (cache.has(key)) {
      setState({ overview: cache.get(key), isLoading: false });
      return undefined;
    }
    let isCancelled = false;
    setState((prev) => ({ overview: prev.overview, isLoading: true }));

    let promise = inflight.get(key);
    if (!promise) {
      promise = fetchOverview(selectedTimeRange)
        .then((payload) => {
          cache.set(key, payload);
          inflight.delete(key);
          return payload;
        })
        .catch((err) => {
          inflight.delete(key);
          throw err;
        });
      inflight.set(key, promise);
    }

    promise
      .then((payload) => {
        if (!isCancelled) setState({ overview: payload, isLoading: false });
      })
      .catch(() => {
        if (!isCancelled) setState({ overview: EMPTY, isLoading: false });
      });

    return () => {
      isCancelled = true;
    };
  }, [key]);

  return state;
}
