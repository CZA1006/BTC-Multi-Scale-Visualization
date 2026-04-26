import React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchMeso } from '../api/meso.js';
import { useAppStore } from '../store/useAppStore.js';
import { getClusterSemanticLabel } from '../utils/clusterLabels.js';
import { ParallelCoordsChart } from '../components/ParallelCoordsChart.jsx';
import { SplomChart } from '../components/SplomChart.jsx';
import { CorrelationMatrix } from '../components/CorrelationMatrix.jsx';
import { ClusterSummaryTable } from '../components/ClusterSummaryTable.jsx';
import { PinInsightButton } from '../components/PinInsightButton.jsx';

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
  const [mesoSecondaryView, setMesoSecondaryView] = useState('parallel');

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
  // Note: inline PC scales/lineBuilder removed in P4 — handled inside
  // <ParallelCoordsChart /> now. Legacy variables (profileWidth/profileHeight/
  // profileMargin/featureScale/verticalScales/profileLines) deleted with them.

  return (
    <section className="view-card">
      <header className="view-header view-header-with-pin">
        <div>
          <p className="view-kicker">View 2</p>
          <h2 className="view-title">Meso Pattern View</h2>
        </div>
        <PinInsightButton view="meso" />
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
            onClick={() => setSelectedCluster(null)}
          >
            Clear
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
              onClick={() => setSelectedCluster(clusterId)}
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
        <h3 className="placeholder-title">Embedding Scatterplot</h3>
        {isLoading ? (
          <div className="placeholder-box">
            <span className="placeholder-label">Loading embedding data...</span>
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
                        stroke={clusterColorScale(hull.clusterId)}
                        strokeOpacity={isActive ? 0.85 : 0.45}
                        strokeWidth={isActive ? 1.5 : 1}
                        strokeDasharray="4 3"
                      />
                      <text
                        x={hull.centroid[0]}
                        y={hull.centroid[1]}
                        textAnchor="middle"
                        className="event-annotation-label"
                        pointerEvents="none"
                      >
                        {semanticLabelForCluster(hull.clusterId)}
                      </text>
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
                ← Market State Similarity Space (UMAP) →
              </text>
            </svg>

            <div className="chart-caption-row">
              <p className="chart-caption">
                Rendered points: {visibleEmbeddingRows.length}
              </p>
              <p className="chart-caption">
                Click a point to update cluster and selected day
              </p>
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
          <div className="meso-summary-grid">
            <ClusterSummaryTable
              clusterProfiles={clusterProfiles}
              parsedFeatureRows={parsedFeatureRows}
              clusterColorScale={clusterColorScale}
              semanticLabelForCluster={semanticLabelForCluster}
              selectedCluster={selectedCluster}
              setSelectedCluster={setSelectedCluster}
            />
            <CorrelationMatrix />
          </div>
          <div className="chart-caption-row">
            <p className="chart-caption">
              Equity curve = cumulative (1 + daily return) restricted to days in that regime.
            </p>
            <p className="chart-caption">
              Correlation uses Pearson on daily returns over the selected window.
            </p>
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
          <div className="tab-row">
            <button
              type="button"
              className={
                mesoSecondaryView === 'parallel'
                  ? 'tab-button tab-button-active'
                  : 'tab-button'
              }
              onClick={() => setMesoSecondaryView('parallel')}
            >
              Parallel Coords
            </button>
            <button
              type="button"
              className={
                mesoSecondaryView === 'splom'
                  ? 'tab-button tab-button-active'
                  : 'tab-button'
              }
              onClick={() => setMesoSecondaryView('splom')}
            >
              SPLOM (top-4)
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">Loading feature explanation data...</span>
          </div>
        ) : hasProfileData ? (
          <div className="chart-shell">
            {mesoSecondaryView === 'parallel' ? (
              <ParallelCoordsChart
                features={FEATURE_COLUMNS}
                dailyRows={parsedFeatureRows}
                clusterProfiles={clusterProfiles}
                clusterColorScale={clusterColorScale}
                selectedCluster={selectedCluster}
                semanticLabelForCluster={semanticLabelForCluster}
              />
            ) : (
              <SplomChart
                dailyRows={parsedFeatureRows}
                clusterColorScale={clusterColorScale}
                selectedCluster={selectedCluster}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                setSelectedCluster={setSelectedCluster}
              />
            )}
          </div>
        ) : (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">No feature profiles available.</span>
          </div>
        )}
      </section>

      <div className="summary-box">
        <p className="summary-title">Meso summary</p>
        <p className="state-label">Feature rows: {filteredFeatureRows.length}</p>
        <p className="state-label">Embedding rows: {visibleEmbeddingRows.length}</p>
        <p className="state-label">
          Unique regimes:{' '}
          {uniqueClusterIds.length > 0
            ? uniqueClusterIds.map((clusterId) => semanticLabelForCluster(clusterId)).join(', ')
            : 'None'}
        </p>
        {errorMessage ? <p className="state-label error-label">Load status: {errorMessage}</p> : null}
      </div>
    </section>
  );
}
