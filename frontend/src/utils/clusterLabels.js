/**
 * KMeans `cluster_id` → label + hue, re-checked on merged `daily_features` +
 * `embedding_results`. Sklearn cluster ids permute across refits: after the latest
 * full embedding rebuild, id 1 = low-vol / near-flat returns, id 2 = bullish surge.
 */

export const CLUSTER_LABEL_MAP = Object.freeze({
  0: 'Bearish Drawdown',
  1: 'Low-Vol Consolidation',
  2: 'Bullish Surge',
});

/** Bear/red · low-vol/blue · bull/green — colors track empirical regime, not id order */
export const CLUSTER_COLOR_MAP = Object.freeze({
  0: '#d9485f',
  1: '#407bff',
  2: '#2f9e44',
});

export const CLUSTER_UNKNOWN_COLOR_HEX = '#868e96';

export const CLUSTER_COLOR_SCALE_DOMAIN_STRINGS = ['0', '1', '2'];

export const CLUSTER_COLOR_SCALE_RANGE = Object.freeze([
  CLUSTER_COLOR_MAP[0],
  CLUSTER_COLOR_MAP[1],
  CLUSTER_COLOR_MAP[2],
]);

export function getClusterSemanticLabel(clusterId) {
  if (clusterId === null || clusterId === undefined || clusterId === '') {
    return 'No cluster selected';
  }
  const numericId = Number(clusterId);
  if (!Number.isNaN(numericId) && CLUSTER_LABEL_MAP[numericId] !== undefined) {
    return CLUSTER_LABEL_MAP[numericId];
  }
  return 'Unknown';
}

export function getClusterColor(clusterId) {
  if (clusterId === null || clusterId === undefined || clusterId === '') {
    return CLUSTER_UNKNOWN_COLOR_HEX;
  }
  const numericId = Number(clusterId);
  if (!Number.isNaN(numericId) && CLUSTER_COLOR_MAP[numericId] !== undefined) {
    return CLUSTER_COLOR_MAP[numericId];
  }
  return CLUSTER_UNKNOWN_COLOR_HEX;
}
