const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

function buildFallbackDayDetail(date) {
  return {
    date,
    btc_detail: null,
    btc_intraday: [],
    btc_window: [],
    external_assets: [],
    context: {
      window_radius_days: 0,
      window_start: null,
      window_end: null,
      has_external_assets: false,
      has_intraday: false,
      event_context_status: 'placeholder',
      narrative_summary: 'Selected-day context is not available yet.',
      narrative_bullets: [],
      market_state: {
        cluster_id: null,
        move_label: 'Unavailable',
        volatility_label: 'Unavailable',
        volume_label: 'Unavailable',
      },
      external_signal_summary: {
        breadth_label: 'No aligned external asset context',
        positive_count: 0,
        negative_count: 0,
        flat_count: 0,
        leader_ticker: null,
        leader_return: null,
      },
      backtracking: {
        macro: {
          selected_date: date,
          month_bucket: null,
          window_start: null,
          window_end: null,
        },
        meso: {
          cluster_id: null,
          cluster_label: 'No cluster match',
          embedding_x: null,
          embedding_y: null,
        },
      },
    },
  };
}

export async function fetchDayDetail(date) {
  if (!date) {
    return buildFallbackDayDetail(null);
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/day-detail?date=${encodeURIComponent(date)}`,
    );
    if (!response.ok) {
      throw new Error(`Day-detail request failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('Falling back to empty day-detail payload.', error);
    return buildFallbackDayDetail(date);
  }
}
