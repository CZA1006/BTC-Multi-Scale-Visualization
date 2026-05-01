/**
 * KMeans `cluster_id` semantics and colors — calibrated against full-sample stats
 * in `daily_features` + `embedding_results` (Bearish pullback cluster, Bullish surge
 * cluster, Low-vol consolidation cluster).
 */

export const CLUSTER_LABEL_MAP = Object.freeze({
  0: 'Bearish Drawdown',
  1: 'Bullish Surge',
  2: 'Low-Vol Consolidation',
});

/** Fill colors: bear/red, bull/green, range-bound/blue; unknown buckets → gray */
export const CLUSTER_COLOR_MAP = Object.freeze({
  0: '#d9485f',
  1: '#2f9e44',
  2: '#407bff',
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
