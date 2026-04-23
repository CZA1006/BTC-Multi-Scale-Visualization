const CLUSTER_LABEL_MAP = {
  0: 'Bullish Rally',
  1: 'Defensive Drift',
  2: 'High-Vol Crash',
  3: 'Defensive Drift',
};

export function getClusterSemanticLabel(clusterId) {
  if (clusterId === null || clusterId === undefined || clusterId === '') {
    return 'No cluster selected';
  }
  const numericId = Number(clusterId);
  if (!Number.isNaN(numericId) && CLUSTER_LABEL_MAP[numericId] !== undefined) {
    return CLUSTER_LABEL_MAP[numericId];
  }
  return 'Defensive Drift';
}
