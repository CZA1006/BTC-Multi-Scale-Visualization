import React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchMeso } from '../api/meso.js';
import { useAppStore } from '../store/useAppStore.js';
import { getClusterSemanticLabel } from '../utils/clusterLabels.js';

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

  const timeRangeLabel = selectedTimeRange
    ? `${selectedTimeRange.start ?? 'unknown'} to ${selectedTimeRange.end ?? 'unknown'}`
    : 'No time range selected';
  const clusterLabel =
    selectedCluster === null || selectedCluster === undefined
      ? 'No cluster selected'
      : semanticLabelForCluster(selectedCluster);
  const selectedDateLabel = selectedDate ?? 'No date selected yet';

  const chartWidth = 920;
  const chartHeight = 300;
  const chartMargin = { top: 20, right: 22, bottom: 36, left: 40 };
  const hasEmbeddingData = visibleEmbeddingRows.length > 0;

  let xScale = null;
  let yScale = null;
  let xTicks = [];
  let yTicks = [];

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
  }

  const clusterColorScale = d3
    .scaleOrdinal()
    .domain(uniqueClusterIds.map(String))
    .range(['#407bff', '#f08c00', '#2f9e44', '#8a5cf6', '#d9485f']);

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

  const profileWidth = 920;
  const profileHeight = 280;
  const profileMargin = { top: 20, right: 28, bottom: 48, left: 28 };
  const hasProfileData = clusterProfiles.length > 0;

  let featureScale = null;
  let verticalScales = {};
  let profileLines = [];

  if (hasProfileData) {
    featureScale = d3
      .scalePoint()
      .domain(FEATURE_COLUMNS)
      .range([profileMargin.left, profileWidth - profileMargin.right]);

    verticalScales = Object.fromEntries(
      FEATURE_COLUMNS.map((feature) => {
        const featureValues = clusterProfiles
          .map((profile) => profile.values[feature])
          .filter((value) => value !== null && value !== undefined);

        const [minValue, maxValue] = d3.extent(featureValues);
        const domainMin = minValue ?? 0;
        const domainMax = maxValue ?? 1;
        const adjustedDomain =
          domainMin === domainMax ? [domainMin - 1, domainMax + 1] : [domainMin, domainMax];

        return [
          feature,
          d3
            .scaleLinear()
            .domain(adjustedDomain)
            .range([profileHeight - profileMargin.bottom, profileMargin.top]),
        ];
      }),
    );

    const lineBuilder = d3
      .line()
      .x(([feature]) => featureScale(feature))
      .y(([feature, value]) => verticalScales[feature](value))
      .curve(d3.curveMonotoneX);

    profileLines = clusterProfiles.map((profile) => ({
      clusterId: profile.clusterId,
      path:
        lineBuilder(
          FEATURE_COLUMNS.map((feature) => [feature, profile.values[feature]]),
        ) ?? '',
    }));
  }

  return (
    <section className="view-card">
      <header className="view-header">
        <p className="view-kicker">View 2</p>
        <h2 className="view-title">Meso Pattern View</h2>
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
              {semanticLabelForCluster(clusterId)}
            </button>
          ))}
        </div>
      </div>

      <section className="placeholder-section">
        <h3 className="placeholder-title">Meso Pattern View</h3>
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
                    stroke={isSelectedDate ? '#162033' : '#ffffff'}
                    strokeWidth={isSelectedDate ? 2.2 : 1.2}
                    opacity={
                      selectedCluster === null || selectedCluster === undefined || isSelectedCluster
                        ? 0.9
                        : 0.28
                    }
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
                fill="#6f8099"
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

      <section className="placeholder-section">
        <h3 className="placeholder-title">Meso Feature Explanation</h3>
        {isLoading ? (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">Loading feature explanation data...</span>
          </div>
        ) : hasProfileData ? (
          <div className="chart-shell">
            <svg
              viewBox={`0 0 ${profileWidth} ${profileHeight}`}
              className="timeline-chart"
              role="img"
              aria-label="Parallel coordinates plot"
            >
              {FEATURE_COLUMNS.map((feature) => (
                <g key={feature}>
                  <line
                    x1={featureScale(feature)}
                    x2={featureScale(feature)}
                    y1={profileMargin.top}
                    y2={profileHeight - profileMargin.bottom}
                    className="chart-gridline chart-gridline-vertical"
                  />
                  <text
                    x={featureScale(feature)}
                    y={profileHeight - 16}
                    textAnchor="middle"
                    className="chart-axis-label"
                  >
                    {feature.replaceAll('_', ' ')}
                  </text>
                </g>
              ))}

              {profileLines.map((profile) => {
                const isSelected =
                  selectedCluster !== null &&
                  selectedCluster !== undefined &&
                  Number(selectedCluster) === Number(profile.clusterId);

                return (
                  <path
                    key={profile.clusterId}
                    d={profile.path}
                    fill="none"
                    stroke={
                      selectedCluster === null || selectedCluster === undefined || isSelected
                        ? clusterColorScale(String(profile.clusterId))
                        : '#cccccc'
                    }
                    strokeWidth={isSelected ? 3.8 : 2}
                    opacity={
                      selectedCluster === null || selectedCluster === undefined || isSelected
                        ? 0.9
                        : 0.22
                    }
                    className="profile-line"
                  />
                );
              })}
            </svg>

            <div className="chart-caption-row">
              <p className="chart-caption">
                Cluster profiles: {clusterProfiles.length}
              </p>
              <p className="chart-caption">
                {selectedCluster === null || selectedCluster === undefined
                  ? 'Showing all cluster-average feature profiles'
                  : `Highlighting feature profile for ${semanticLabelForCluster(selectedCluster)}`}
              </p>
            </div>
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
        <p className="state-label">Shared state: {timeRangeLabel}</p>
        <p className="state-label">Shared state: {clusterLabel}</p>
        <p className="state-label">Shared state: {selectedDateLabel}</p>
        {errorMessage ? <p className="state-label">Load status: {errorMessage}</p> : null}
      </div>
    </section>
  );
}
