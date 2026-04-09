const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

function buildFallbackMeso() {
  return {
    daily_features: [],
    embedding_results: [],
  };
}

export async function fetchMeso() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/meso`);
    if (!response.ok) {
      throw new Error(`Meso request failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('Falling back to empty meso payload.', error);
    return buildFallbackMeso();
  }
}
