const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

function buildFallbackDayDetail(date) {
  return {
    date,
    btc_detail: null,
    btc_intraday: [],
    btc_window: [],
    external_assets: [],
    gdelt_selected_day: {
      date,
      status: 'placeholder',
      message: 'Selected-day event context is not available yet.',
      news_count: 0,
      theme_count_crypto: 0,
      theme_count_regulation: 0,
      theme_count_election: 0,
      theme_count_war: 0,
      top_headlines: [],
    },
    events_selected_day: [],
    polymarket_selected_day: {
      as_of_date: date,
      status: 'placeholder',
      message: 'Polymarket context is not available yet.',
      markets: [],
    },
    context: {
      window_radius_days: 0,
      window_start: null,
      window_end: null,
      has_external_assets: false,
      has_intraday: false,
      event_context_status: 'placeholder',
      event_context_message: 'Selected-day event context is not available yet.',
      has_polymarket: false,
      polymarket_status: 'placeholder',
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

  const response = await fetch(
    `${API_BASE_URL}/api/day-detail?date=${encodeURIComponent(date)}`,
  );
  if (!response.ok) {
    throw new Error(`Day-detail request failed: ${response.status}`);
  }
  return await response.json();
}
