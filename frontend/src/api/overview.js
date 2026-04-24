const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

export async function fetchOverview(range = null) {
  const params = new URLSearchParams();
  if (range?.start) {
    params.set('start', range.start);
  }
  if (range?.end) {
    params.set('end', range.end);
  }

  const queryString = params.toString();
  const url = queryString ? `${API_BASE_URL}/api/overview?${queryString}` : `${API_BASE_URL}/api/overview`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Overview request failed: ${response.status}`);
  }
  return await response.json();
}
