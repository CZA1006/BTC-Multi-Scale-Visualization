import React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchMeso } from '../api/meso.js';
import { useAppStore } from '../store/useAppStore.js';
import { getClusterSemanticLabel } from '../utils/clusterLabels.js';
import { ParallelCoordsChart } from '../components/ParallelCoordsChart.jsx';
import { CorrelationMatrix } from '../components/CorrelationMatrix.jsx';
import { ClusterSummaryTable } from '../components/ClusterSummaryTable.jsx';

const FEATURE_COLUMNS = [
  'daily_return',
  'open_close_change',
  'high_low_range',
  'volume_zscore',
  'rolling_volatility_7d',
  'rolling_volatility_30d',
  'drawdown_from_30d_high',
];

export function MesoView() {
  const selectedTimeRange = useAppStore((state) => state.selectedTimeRange);
  const selectedCluster = useAppStore((state) => state.selectedCluster);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedCluster = useAppStore((state) => state.setSelectedCluster);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);

  const [mesoPayload, setMesoPayload] = useState({
    daily_features: [],
    embedding_results: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const lastSyncedDateRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMeso() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const payload = await fetchMeso();
        if (isCancelled) {
          return;
        }
        setMesoPayload(payload);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load meso data');
        setMesoPayload({
          daily_features: [],
          embedding_results: [],
        });
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMeso();
    return () => {
      isCancelled = true;
    };
  }, []);

  const parsedEmbeddingRows = mesoPayload.embedding_results
    .map((row) => ({
      ...row,
      xValue: Number(row.x),
      yValue: Number(row.y),
      clusterValue: row.cluster_id,
      parsedDate: row.date ? new Date(`${row.date}T00:00:00`) : null,
    }))
    .filter(
      (row) =>
        row.parsedDate instanceof Date &&
        !Number.isNaN(row.xValue) &&
        !Number.isNaN(row.yValue),
    );

  const filteredEmbeddingRows = selectedTimeRange
    ? parsedEmbeddingRows.filter((row) => {
        const start = selectedTimeRange.start
          ? new Date(`${selectedTimeRange.start}T00:00:00`)
          : null;
        const end = selectedTimeRange.end ? new Date(`${selectedTimeRange.end}T00:00:00`) : null;

        if (start && row.parsedDate < start) {
          return false;
        }
        if (end && row.parsedDate > end) {
          return false;
        }
        return true;
      })
    : parsedEmbeddingRows;

  const visibleEmbeddingRows =
    filteredEmbeddingRows.length > 0 ? filteredEmbeddingRows : parsedEmbeddingRows;

  useEffect(() => {
    if (!selectedDate || selectedDate === lastSyncedDateRef.current || parsedEmbeddingRows.length === 0) {
      return;
    }

    const matchedRow = parsedEmbeddingRows.find((row) => row.date === selectedDate);
    if (!matchedRow) {
      lastSyncedDateRef.current = selectedDate;
      return;
    }

    lastSyncedDateRef.current = selectedDate;
    if (Number(selectedCluster) !== Number(matchedRow.clusterValue)) {
      setSelectedCluster(matchedRow.clusterValue);
    }
  }, [parsedEmbeddingRows, selectedCluster, selectedDate, setSelectedCluster]);

  const visibleDates = new Set(visibleEmbeddingRows.map((row) => row.date));
  const filteredFeatureRows = mesoPayload.daily_features.filter((row) => visibleDates.has(row.date));

  const clusterByDate = new Map(visibleEmbeddingRows.map((row) => [row.date, row.clusterValue]));
  const parsedFeatureRows = filteredFeatureRows
    .map((row) => {
      const parsedRow = {
        date: row.date,
        clusterValue: clusterByDate.get(row.date),
      };

      for (const feature of FEATURE_COLUMNS) {
        const rawValue = row[feature];
        if (rawValue === null || rawValue === undefined || rawValue === '') {
          parsedRow[feature] = null;
          continue;
        }

        const numericValue = Number(rawValue);
        parsedRow[feature] = Number.isNaN(numericValue) ? null : numericValue;
      }

      return parsedRow;
    })
    .filter((row) => row.clusterValue !== null && row.clusterValue !== undefined);

  const semanticLabelForCluster = (clusterId) => getClusterSemanticLabel(clusterId);

  const uniqueClusterIds = [
    ...new Set(
      visibleEmbeddingRows
        .map((row) => row.clusterValue)
        .filter((clusterId) => clusterId !== null && clusterId !== undefined),
    ),
  ].sort((left, right) => Number(left) - Number(right));

  const timeRangeLabel = selectedTimeRange
    ? `${selectedTimeRange.start ?? 'unknown'} to ${selectedTimeRange.end ?? 'unknown'}`
    : 'No time range selected';

  const chartWidth = 920;
  const chartHeight = 300;
  const chartMargin = { top: 20, right: 22, bottom: 36, left: 40 };
  const hasEmbeddingData = visibleEmbeddingRows.length > 0;

  let xScale = null;
  let yScale = null;
  let xTicks = [];
  let yTicks = [];

  let densityPaths = [];
  let clusterHulls = [];

  if (hasEmbeddingData) {
    xScale = d3
      .scaleLinear()
      .domain(d3.extent(visibleEmbeddingRows, (row) => row.xValue))
      .nice()
      .range([chartMargin.left, chartWidth - chartMargin.right]);

    yScale = d3
      .scaleLinear()
      .domain(d3.extent(visibleEmbeddingRows, (row) => row.yValue))
      .nice()
      .range([chartHeight - chartMargin.bottom, chartMargin.top]);

    xTicks = xScale.ticks(5);
    yTicks = yScale.ticks(4);

    // Density splat — single-color underlay highlighting the overall point cloud.
    const points = visibleEmbeddingRows.map((row) => [xScale(row.xValue), yScale(row.yValue)]);
    if (points.length > 8) {
      const density = d3
        .contourDensity()
        .x((p) => p[0])
        .y((p) => p[1])
        .size([chartWidth, chartHeight])
        .bandwidth(18)
        .thresholds(6)(points);
      densityPaths = density.map((c) => d3.geoPath()(c));
    }

    // Convex hulls per cluster.
    const byCluster = new Map();
    for (const row of visibleEmbeddingRows) {
      const key = String(row.clusterValue);
      if (!byCluster.has(key)) byCluster.set(key, []);
      byCluster.get(key).push([xScale(row.xValue), yScale(row.yValue)]);
    }
    clusterHulls = Array.from(byCluster.entries())
      .map(([clusterId, pts]) => {
        if (pts.length < 3) return null;
        const hull = d3.polygonHull(pts);
        if (!hull) return null;
        const centroid = d3.polygonCentroid(hull);
        return {
          clusterId,
          path: `M${hull.map((p) => p.join(',')).join('L')}Z`,
          centroid,
        };
      })
      .filter(Boolean);
  }

  // ColorBrewer Set2 — BTC orange (#f7931a) deliberately excluded so the BTC
  // price line stays unique. Eight colors cover up to 8 clusters.
  const [hoveredClusterId, setHoveredClusterId] = useState(null);

  const clusterColorScale = d3
    .scaleOrdinal()
    .domain(uniqueClusterIds.map(String))
    .range([
      '#66c2a5',
      '#8da0cb',
      '#e78ac3',
      '#a6d854',
      '#ffd92f',
      '#e5c494',
      '#b3b3b3',
      '#fc8d62',
    ]);

  const clusterProfiles = uniqueClusterIds
    .map((clusterId) => {
      const rows = parsedFeatureRows.filter(
        (row) => Number(row.clusterValue) === Number(clusterId),
      );
      if (rows.length === 0) {
        return null;
      }

      const values = {};
      for (const feature of FEATURE_COLUMNS) {
        const featureValues = rows
          .map((row) => row[feature])
          .filter((value) => value !== null && value !== undefined);

        values[feature] =
          featureValues.length > 0 ? d3.mean(featureValues) : 0;
      }

      return {
        clusterId,
        values,
      };
    })
    .filter(Boolean);

  const hasProfileData = clusterProfiles.length > 0;

  const correlationClusterDates =
    selectedCluster === null || selectedCluster === undefined
      ? []
      : visibleEmbeddingRows
          .filter((row) => Number(row.clusterValue) === Number(selectedCluster))
          .map((row) => row.date);

  const correlationClusterLabel =
    selectedCluster === null || selectedCluster === undefined
      ? 'All regimes'
      : semanticLabelForCluster(selectedCluster);

  const selectedRegimeColor =
    selectedCluster === null || selectedCluster === undefined
      ? 'var(--text-muted)'
      : clusterColorScale(String(selectedCluster));

  function handleManualClusterChange(nextCluster) {
    // Manual cluster switching should clear the selected day.
    // Otherwise the parallel coordinates view keeps showing a stale selected-day line.
    setSelectedDate(null);
    lastSyncedDateRef.current = null;
    setSelectedCluster(nextCluster);
  }

  // Note: inline PC scales/lineBuilder removed in P4 — handled inside
  // <ParallelCoordsChart /> now. Legacy variables (profileWidth/profileHeight/
  // profileMargin/featureScale/verticalScales/profileLines) deleted with them.

  return (
    <section className="view-card">
      <header className="view-header">
        <div>
          <p className="view-kicker">View 2</p>
          <h2 className="view-title">Meso Overview: Market Regime View</h2>
        </div>
      </header>

      <div className="control-group">
        <span className="control-label">Cluster selector</span>
        <div className="control-row">
          <button
            type="button"
            className={
              selectedCluster === null || selectedCluster === undefined
                ? 'range-button range-button-active'
                : 'range-button'
            }
            onClick={() => handleManualClusterChange(null)}
          >
            All Regimes
          </button>
          {uniqueClusterIds.map((clusterId) => (
            <button
              key={clusterId}
              type="button"
              className={
                selectedCluster === clusterId
                  ? 'range-button range-button-active'
                  : 'range-button'
              }
              onClick={() => handleManualClusterChange(clusterId)}
            >
              <span
                className="cluster-swatch"
                style={{ backgroundColor: clusterColorScale(String(clusterId)) }}
                aria-hidden="true"
              />
              {semanticLabelForCluster(clusterId)}
            </button>
          ))}
        </div>
      </div>

      <section className="placeholder-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 className="placeholder-title" style={{ margin: 0 }}>Embedding Scatterplot: Daily Market States</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="chart-range-pill">{timeRangeLabel}</span>
            {selectedDate ? (
              <span className="chart-range-pill" title={`Selected date: ${selectedDate}`}>
                {selectedDate}
              </span>
            ) : null}
          </div>
        </div>
        {isLoading ? (
          <div className="placeholder-box">
            <span className="placeholder-label">Loading embedding data...</span>
          </div>
        ) : errorMessage ? (
          <div className="placeholder-box">
            <span className="placeholder-label">Failed to load meso data: {errorMessage}</span>
          </div>
        ) : hasEmbeddingData ? (
          <div className="chart-shell">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="timeline-chart"
              role="img"
              aria-label="Embedding scatterplot"
            >
              {yTicks.map((tick) => (
                <g key={`meso-y-${tick}`}>
                  <line
                    x1={chartMargin.left}
                    x2={chartWidth - chartMargin.right}
                    y1={yScale(tick)}
                    y2={yScale(tick)}
                    className="chart-gridline"
                  />
                </g>
              ))}

              {xTicks.map((tick) => (
                <g key={`meso-x-${tick}`}>
                  <line
                    x1={xScale(tick)}
                    x2={xScale(tick)}
                    y1={chartMargin.top}
                    y2={chartHeight - chartMargin.bottom}
                    className="chart-gridline chart-gridline-vertical"
                  />
                </g>
              ))}

              {/* Density splat underlay (single-hue, low opacity, BTC orange tint) */}
              <g className="density-splat" pointerEvents="none">
                {densityPaths.map((d, i) => (
                  <path
                    key={`den-${i}`}
                    d={d}
                    fill="#f7931a"
                    opacity={0.04 + i * 0.025}
                  />
                ))}
              </g>

              {/* Cluster hulls (GMap-style regions) */}
              <g className="cluster-hulls">
                {clusterHulls.map((hull) => {
                  const isActive =
                    selectedCluster !== null &&
                    selectedCluster !== undefined &&
                    String(selectedCluster) === hull.clusterId;
                  const isHovered = hoveredClusterId === hull.clusterId;
                  const fade =
                    selectedCluster !== null &&
                    selectedCluster !== undefined &&
                    !isActive
                      ? 0.05
                      : isHovered
                        ? 0.2
                        : 0.12;
                  return (
                    <g
                      key={`hull-${hull.clusterId}`}
                      onMouseEnter={() => setHoveredClusterId(hull.clusterId)}
                      onMouseLeave={() => setHoveredClusterId(null)}
                    >
                      <path
                        d={hull.path}
                        fill={clusterColorScale(hull.clusterId)}
                        fillOpacity={fade}
                        stroke="none"
                      />

                    </g>
                  );
                })}
              </g>

              {visibleEmbeddingRows.map((row) => {
                const isSelectedCluster =
                  selectedCluster !== null &&
                  selectedCluster !== undefined &&
                  Number(selectedCluster) === Number(row.clusterValue);
                const isSelectedDate = selectedDate === row.date;
                const radius = isSelectedDate ? 6.5 : isSelectedCluster ? 5.5 : 4.2;

                return (
                  <circle
                    key={row.date}
                    cx={xScale(row.xValue)}
                    cy={yScale(row.yValue)}
                    r={radius}
                    fill={clusterColorScale(String(row.clusterValue))}
                    stroke={isSelectedDate ? '#ffffff' : 'rgba(11,15,23,0.6)'}
                    strokeWidth={isSelectedDate ? 2.2 : 0.8}
                    opacity={(() => {
                      const isHovered = hoveredClusterId === String(row.clusterValue);
                      if (selectedCluster !== null && selectedCluster !== undefined) {
                        return isSelectedCluster ? 0.95 : 0.18;
                      }
                      if (hoveredClusterId !== null) {
                        return isHovered ? 0.95 : 0.2;
                      }
                      return 0.9;
                    })()}
                    className="scatter-point"
                    onClick={() => {
                      setSelectedCluster(row.clusterValue);
                      setSelectedDate(row.date);
                    }}
                  >
                    <title>{`${row.date} | ${semanticLabelForCluster(row.clusterValue)}`}</title>
                  </circle>
                );
              })}
              <text
                x={(chartMargin.left + (chartWidth - chartMargin.right)) / 2}
                y={chartHeight - 8}
                textAnchor="middle"
                className="chart-axis-label"
                fontSize="11"
              >
                X-axis: UMAP Dimension 1
              </text>
              <text
                transform={`translate(14 ${(chartMargin.top + (chartHeight - chartMargin.bottom)) / 2}) rotate(-90)`}
                textAnchor="middle"
                className="chart-axis-label"
                fontSize="11"
              >
                Y-axis: UMAP Dimension 2
              </text>
            </svg>

            <div className="chart-caption-row">
              <p className="chart-caption">Rendered points: {visibleEmbeddingRows.length}</p>
              <p className="chart-caption">Click a point to update cluster and selected day</p>
            </div>
          </div>
        ) : (
          <div className="placeholder-box">
            <span className="placeholder-label">No embedding rows available.</span>
          </div>
        )}
      </section>

      {hasProfileData ? (
        <section className="placeholder-section">
          <h3 className="placeholder-title">Regime Summary</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2.35fr) minmax(320px, 0.85fr)',
              alignItems: 'start',
              gap: 18,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <ClusterSummaryTable
                clusterProfiles={clusterProfiles}
                parsedFeatureRows={parsedFeatureRows}
                clusterColorScale={clusterColorScale}
                semanticLabelForCluster={semanticLabelForCluster}
                selectedCluster={selectedCluster}
                setSelectedCluster={handleManualClusterChange}
              />

              <div className="chart-caption-row" style={{ marginTop: 16 }}>
                <p
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: '0.76rem',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                  }}
                >
                  Notes:
                </p>
                <p className="chart-caption">
                  • Mean Ret = average daily return; positive indicates gains, negative indicates losses.
                </p>
                <p className="chart-caption">
                  • Mean Vol = average 30-day rolling volatility; higher values indicate larger price swings.
                </p>
                <p className="chart-caption">
                  • Mean DD = average drawdown from 30-day high; how far the regime typically falls from recent peaks.
                </p>
                <p className="chart-caption">
                  • Equity curve = cumulative (1 + daily return) restricted to days in that regime.
                </p>
                <p className="chart-caption">
                  • Correlation uses Pearson on daily returns over the selected window.
                  If a regime is selected, it is recalculated using only days in that regime.
                </p>
              </div>
            </div>

            <div style={{ minWidth: 0, width: '100%' }}>
              <CorrelationMatrix
                selectedCluster={selectedCluster}
                clusterDates={correlationClusterDates}
                clusterLabel={correlationClusterLabel}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="placeholder-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <h3 className="placeholder-title" style={{ margin: 0 }}>
            Meso Feature Explanation
          </h3>
          <span className="chart-range-pill">Parallel Coordinates</span>
        </div>

        {isLoading ? (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">Loading feature explanation data...</span>
          </div>
        ) : hasProfileData ? (
          <div className="chart-shell">
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 14,
                marginBottom: 8,
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 30,
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: selectedRegimeColor,
                  }}
                />
                Regime mean profile
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 30,
                    height: 2,
                    borderRadius: 999,
                    backgroundColor: selectedRegimeColor,
                    opacity: 0.55,
                  }}
                />
                Selected day profile
              </span>
            </div>
            <ParallelCoordsChart
              features={FEATURE_COLUMNS}
              dailyRows={parsedFeatureRows}
              clusterProfiles={clusterProfiles}
              clusterColorScale={clusterColorScale}
              selectedCluster={selectedCluster}
              selectedDate={selectedDate}
              semanticLabelForCluster={semanticLabelForCluster}
            />
          </div>
        ) : (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">No feature profiles available.</span>
          </div>
        )}
      </section>
    </section>
  );
}
