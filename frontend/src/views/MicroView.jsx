import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HeadlineWordCloud } from '../components/HeadlineWordCloud.jsx';
import { PolymarketSparkline } from '../components/PolymarketSparkline.jsx';
import { ThemeRiverMini } from '../components/ThemeRiverMini.jsx';
import { PinInsightButton } from '../components/PinInsightButton.jsx';
import { fetchDayDetail } from '../api/dayDetail.js';
import { useAppStore } from '../store/useAppStore.js';
import { getClusterSemanticLabel } from '../utils/clusterLabels.js';

export function MicroView() {
  const selectedDate = useAppStore((state) => state.selectedDate);
  const selectedCluster = useAppStore((state) => state.selectedCluster);

  const [dayDetail, setDayDetail] = useState({
    btc_detail: null,
    btc_intraday: [],
    btc_window: [],
    external_assets: [],
    context: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const chartRef = useRef(null);

  useEffect(() => {
    if (!selectedDate) {
      setDayDetail({
        btc_detail: null,
        btc_intraday: [],
        btc_window: [],
        external_assets: [],
        context: null,
      });
      setErrorMessage('');
      setIsLoading(false);
      return undefined;
    }

    let isCancelled = false;

    async function loadDayDetail() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const payload = await fetchDayDetail(selectedDate);
        if (isCancelled) {
          return;
        }
        setDayDetail(payload);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load day detail');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDayDetail();
    return () => {
      isCancelled = true;
    };
  }, [selectedDate]);

  const selectedDateLabel = selectedDate ?? 'No date selected yet';
  const selectedClusterLabel =
    selectedCluster === null || selectedCluster === undefined
      ? 'No cluster selected'
      : getClusterSemanticLabel(selectedCluster);

  const toUtcHourKey = (timeLike) => {
    if (!timeLike) {
      return null;
    }
    const raw = String(timeLike).trim();
    const hourPrefixMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2})/);
    if (hourPrefixMatch) {
      return `${hourPrefixMatch[1]}T${hourPrefixMatch[2]}:00:00.000Z`;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        parsed.getUTCHours(),
        0,
        0,
        0,
      ),
    ).toISOString();
  };

  const formatHourLabel = (utcHourKey) => {
    if (!utcHourKey || utcHourKey.length < 13) {
      return 'N/A';
    }
    return `${utcHourKey.slice(11, 13)}:00`;
  };

  const GDELT_TONE_NEGATIVE_THRESHOLD = -0.5;
  const GDELT_TONE_POSITIVE_THRESHOLD = 0.5;

  const priceSeries = useMemo(() => {
    const buildRow = (timestamp, row) => {
      const closeValue = Number(row.close);
      if (!timestamp || Number.isNaN(closeValue)) return null;
      const openRaw = Number(row.open);
      const highRaw = Number(row.high);
      const lowRaw = Number(row.low);
      const volumeValue = Number(row.volume ?? 0);
      const open = Number.isNaN(openRaw) ? closeValue : openRaw;
      const high = Number.isNaN(highRaw) ? Math.max(open, closeValue) : highRaw;
      const low = Number.isNaN(lowRaw) ? Math.min(open, closeValue) : lowRaw;
      return {
        timestamp,
        price: closeValue,
        open,
        high,
        low,
        close: closeValue,
        volume: Number.isNaN(volumeValue) ? 0 : volumeValue,
        hasOhlc: !Number.isNaN(openRaw) && !Number.isNaN(highRaw) && !Number.isNaN(lowRaw),
      };
    };

    const intraday = (dayDetail.btc_intraday ?? [])
      .map((row) => buildRow(toUtcHourKey(row.timestamp), row))
      .filter(Boolean);
    if (intraday.length > 1) {
      return { mode: 'intraday', rows: intraday };
    }

    const windowRows = (dayDetail.btc_window ?? [])
      .map((row) => buildRow(row.date ? `${row.date}T00:00:00.000Z` : null, row))
      .filter(Boolean);
    return { mode: 'daily_window', rows: windowRows };
  }, [dayDetail.btc_intraday, dayDetail.btc_window]);

  const inferToneFromHeadline = (headline) => {
    if (!headline) {
      return null;
    }
    const text = String(headline).toLowerCase();
    const positiveKeywords = ['rally', 'surge', 'gain', 'rise', 'high', 'record', 'outperform', 'bull'];
    const negativeKeywords = ['crash', 'drop', 'fall', 'fear', 'war', 'selloff', 'violation', 'decline', 'risk'];
    let score = -0.8; // global-news negativity bias baseline
    positiveKeywords.forEach((keyword) => {
      if (text.includes(keyword)) score += 0.7;
    });
    negativeKeywords.forEach((keyword) => {
      if (text.includes(keyword)) score -= 0.7;
    });
    return Number(score.toFixed(2));
  };

  const hourlyToneBars = useMemo(() => {
    const events = Array.isArray(dayDetail.events_selected_day) ? dayDetail.events_selected_day : [];
    const eventBuckets = new Map();
    const dedupe = new Set();
    events.forEach((event) => {
      const dedupeKey = `${event.url ?? ''}::${event.headline ?? ''}`;
      if (dedupe.has(dedupeKey)) {
        return;
      }
      dedupe.add(dedupeKey);
      const key = toUtcHourKey(event.timestamp);
      if (!key) {
        return;
      }
      const previous = eventBuckets.get(key) ?? { timestamp: key, news_count: 0, toneAcc: 0, toneN: 0 };
      const rawToneValue =
        event.average_tone ??
        event.avg_tone ??
        event.v2_rawtone ??
        event.raw_tone ??
        event.sentiment ??
        event.tone;
      const parsedToneValue =
        rawToneValue === null || rawToneValue === undefined || rawToneValue === ''
          ? inferToneFromHeadline(event.headline)
          : Number(rawToneValue);
      previous.news_count += 1;
      if (parsedToneValue !== null && !Number.isNaN(parsedToneValue)) {
        previous.toneAcc += parsedToneValue;
        previous.toneN += 1;
      }
      eventBuckets.set(key, previous);
    });
    const eventHourly = Array.from(eventBuckets.values())
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((item) => ({
        timestamp: item.timestamp,
        news_count: item.news_count,
        average_tone: item.toneN > 0 ? item.toneAcc / item.toneN : null,
      }));

    const rawHourly = Array.isArray(dayDetail?.gdelt_selected_day?.hourly_tones)
      ? dayDetail.gdelt_selected_day.hourly_tones
      : [];
    const rawHourlyMap = new Map(
      rawHourly
        .map((row) => {
          const timestampRaw = row.hour ?? row.timestamp ?? row.time ?? row.hour_ts;
          const key = toUtcHourKey(timestampRaw);
          const newsCount = Number(row.news_count ?? row.count ?? 0);
          const rawTone =
            row.average_tone ?? row.avg_tone ?? row.v2_rawtone ?? row.raw_tone ?? row.tone ?? row.sentiment;
          const averageTone = rawTone === null || rawTone === undefined || rawTone === '' ? null : Number(rawTone);
          if (!key || Number.isNaN(newsCount)) {
            return null;
          }
          return [
            key,
            {
              timestamp: key,
              news_count: Math.max(0, Math.round(newsCount)),
              average_tone: Number.isNaN(averageTone) ? null : averageTone,
            },
          ];
        })
        .filter(Boolean),
    );
    const eventHourlyMap = new Map(eventHourly.map((row) => [row.timestamp, row]));
    const unionKeys = [...new Set([...rawHourlyMap.keys(), ...eventHourlyMap.keys()])].sort();

    return unionKeys.map((timestamp) => {
      const raw = rawHourlyMap.get(timestamp);
      const fallback = eventHourlyMap.get(timestamp);
      return {
        timestamp,
        news_count: raw?.news_count ?? fallback?.news_count ?? 0,
        average_tone:
          raw?.average_tone !== null && raw?.average_tone !== undefined
            ? raw.average_tone
            : fallback?.average_tone ?? null,
      };
    });
  }, [dayDetail.events_selected_day, dayDetail.gdelt_selected_day]);

  const hasDetailChart = priceSeries.rows.length > 1;
  const sharedTimeline = useMemo(() => {
    if (priceSeries.mode === 'intraday') {
      if (!selectedDate) {
        return priceSeries.rows.map((row) => row.timestamp).filter(Boolean);
      }
      return Array.from({ length: 24 }, (_, hour) => {
        const hourText = String(hour).padStart(2, '0');
        return `${selectedDate}T${hourText}:00:00.000Z`;
      });
    }
    return priceSeries.rows.map((row) => row.timestamp).filter(Boolean);
  }, [priceSeries.mode, priceSeries.rows, selectedDate]);
  const pricePointByTimestamp = useMemo(() => {
    const map = new Map();
    priceSeries.rows.forEach((row) => {
      const key = row.timestamp;
      if (!key) {
        return;
      }
      map.set(key, row);
    });
    return map;
  }, [priceSeries.mode, priceSeries.rows]);
  const gdeltPointByTimestamp = useMemo(() => {
    const map = new Map();
    hourlyToneBars.forEach((row) => {
      const key = toUtcHourKey(row.timestamp);
      if (!key) {
        return;
      }
      map.set(key, row);
    });
    return map;
  }, [hourlyToneBars]);
  const priceValues = priceSeries.rows.map((row) => row.price).filter((value) => Number.isFinite(value));
  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : null;
  const pricePadding =
    minPrice !== null && maxPrice !== null ? Math.max((maxPrice - minPrice) * 0.08, maxPrice * 0.002) : 0;
  const roundedMinPrice =
    minPrice !== null && maxPrice !== null
      ? Math.floor(Math.max(0, minPrice - pricePadding))
      : undefined;
  const roundedMaxPrice =
    minPrice !== null && maxPrice !== null
      ? Math.ceil(maxPrice + pricePadding)
      : undefined;

  useEffect(() => {
    if (!chartRef.current || !hasDetailChart) {
      return undefined;
    }
    let chart = null;
    let resizeHandler = null;
    let cancelled = false;

    const candleData = sharedTimeline.map((timestamp) => {
      const point = pricePointByTimestamp.get(timestamp);
      if (!point) return [null, null, null, null];
      // ECharts candlestick expects [open, close, low, high]
      return [point.open, point.close, point.low, point.high];
    });
    const lineCloseData = sharedTimeline.map((timestamp) => {
      const point = pricePointByTimestamp.get(timestamp);
      return point ? point.close : null;
    });
    const volumeData = sharedTimeline.map((timestamp) => {
      const point = pricePointByTimestamp.get(timestamp);
      if (!point) return { value: 0, color: '#6b7890' };
      const isUp = point.close >= point.open;
      return {
        value: point.volume,
        itemStyle: { color: isUp ? '#2ca02c' : '#d62728', opacity: 0.75 },
      };
    });
    const hasOhlc = priceSeries.rows.some((r) => r.hasOhlc);
    const gdeltSeriesData = sharedTimeline.map((timestamp) => {
      const point = gdeltPointByTimestamp.get(timestamp);
      return {
        value: point ? point.news_count : 0,
        average_tone: point?.average_tone ?? null,
      };
    });
    const chartOption = {
      animation: false,
      backgroundColor: 'transparent',
      textStyle: { color: '#aab6cc' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          const rows = Array.isArray(params) ? params : [];
          const btc = rows.find((item) => item.seriesName === 'BTC Price');
          const gdelt = rows.find((item) => item.seriesName === 'GDELT News Volume');
          const timestamp = btc?.axisValueLabel ?? gdelt?.axisValueLabel ?? rows?.[0]?.axisValueLabel ?? 'N/A';
          // For candlestick, btc.data = [idx, open, close, low, high] or [O,C,L,H]; for line it's the close.
          let btcPrice = btc?.data;
          if (Array.isArray(btcPrice)) {
            btcPrice = btcPrice.length === 5 ? btcPrice[2] : btcPrice[1];
          }
          const gdeltNewsCount = gdelt?.data?.value ?? 0;
          const gdeltAvgTone = gdelt?.data?.average_tone;
          const toneLabel =
            gdeltAvgTone === null || gdeltAvgTone === undefined || Number.isNaN(Number(gdeltAvgTone))
              ? 'N/A'
              : Number(gdeltAvgTone).toFixed(2);
          const timestampText = String(timestamp);
          return [
            `${timestampText.slice(0, 10)} ${formatHourLabel(timestampText)}`,
            `BTC Price: ${formatCurrency(btcPrice)}`,
            `GDELT News: ${gdeltNewsCount} articles | Avg Tone: ${toneLabel}`,
          ].join('<br/>');
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1, 2] },
        { type: 'slider', xAxisIndex: [0, 1, 2], bottom: '2%', height: 16 },
      ],
      grid: [
        { top: '6%', height: '50%', left: '8%', right: '5%' },
        { top: '60%', height: '14%', left: '8%', right: '5%' },
        { top: '78%', height: '14%', left: '8%', right: '5%' },
      ],
      xAxis: [
        {
          type: 'category',
          gridIndex: 0,
          data: sharedTimeline,
          axisPointer: { label: { show: false } },
          axisLabel: { show: false },
          axisTick: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: sharedTimeline,
          axisPointer: { label: { show: false } },
          axisLabel: { show: false },
          axisTick: { show: false },
        },
        {
          type: 'category',
          gridIndex: 2,
          data: sharedTimeline,
          axisPointer: { label: { show: false } },
          axisLabel: {
            color: '#aab6cc',
            interval: 1,
            formatter: (value, index) => (index % 2 === 0 ? formatHourLabel(value) : ''),
          },
        },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          name: 'BTC Price',
          nameTextStyle: { color: '#aab6cc' },
          scale: true,
          axisLabel: { color: '#aab6cc' },
          splitLine: { lineStyle: { color: '#263247' } },
          axisPointer: { label: { show: false } },
          min: roundedMinPrice,
          max: roundedMaxPrice,
        },
        {
          type: 'value',
          gridIndex: 1,
          name: 'Volume',
          nameTextStyle: { color: '#aab6cc' },
          nameLocation: 'middle',
          nameRotate: 90,
          nameGap: 50,
          axisLabel: { color: '#aab6cc' },
          splitLine: { lineStyle: { color: '#1f2a40' } },
          axisPointer: { label: { show: false } },
          minInterval: 1,
        },
        {
          type: 'value',
          gridIndex: 2,
          name: 'GDELT News',
          nameTextStyle: { color: '#aab6cc' },
          nameLocation: 'middle',
          nameRotate: 90,
          nameGap: 50,
          axisLabel: { color: '#aab6cc' },
          splitLine: { lineStyle: { color: '#1f2a40' } },
          axisPointer: { label: { show: false } },
          minInterval: 1,
        },
      ],
      series: [
        hasOhlc
          ? {
              type: 'candlestick',
              name: 'BTC Price',
              xAxisIndex: 0,
              yAxisIndex: 0,
              data: candleData,
              itemStyle: {
                color: '#2ca02c',       // bullish fill
                color0: '#d62728',      // bearish fill
                borderColor: '#2ca02c',
                borderColor0: '#d62728',
                borderWidth: 1,
              },
            }
          : {
              type: 'line',
              name: 'BTC Price',
              xAxisIndex: 0,
              yAxisIndex: 0,
              data: lineCloseData,
              showSymbol: false,
              smooth: false,
              lineStyle: { color: '#f7931a', width: 2 },
              areaStyle: { color: 'rgba(247, 147, 26, 0.12)' },
            },
        {
          type: 'bar',
          name: 'Volume',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 14,
          data: volumeData,
        },
        {
          type: 'bar',
          name: 'GDELT News Volume',
          xAxisIndex: 2,
          yAxisIndex: 2,
          barMaxWidth: 14,
          data: gdeltSeriesData,
          itemStyle: {
            color: (params) => {
              const averageTone = params?.data?.average_tone;
              if (averageTone === null || averageTone === undefined || Number.isNaN(Number(averageTone))) {
                return '#ced4da';
              }
              if (averageTone > GDELT_TONE_POSITIVE_THRESHOLD) {
                return '#2f9e44';
              }
              if (averageTone < GDELT_TONE_NEGATIVE_THRESHOLD) {
                return '#d9485f';
              }
              return '#ced4da';
            },
            opacity: (params) => {
              const averageTone = params?.data?.average_tone;
              if (averageTone === null || averageTone === undefined || Number.isNaN(Number(averageTone))) {
                return 0.4;
              }
              if (
                averageTone > GDELT_TONE_POSITIVE_THRESHOLD ||
                averageTone < GDELT_TONE_NEGATIVE_THRESHOLD
              ) {
                return 0.9;
              }
              return 0.4;
            },
          },
        },
      ],
    };

    (async () => {
      const echarts = await import('echarts');
      if (cancelled || !chartRef.current) {
        return;
      }
      chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
      chart.setOption(chartOption);
      resizeHandler = () => chart && chart.resize();
      window.addEventListener('resize', resizeHandler);
    })();

    return () => {
      cancelled = true;
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (chart) {
        chart.dispose();
      }
    };
  }, [
    gdeltPointByTimestamp,
    hasDetailChart,
    pricePointByTimestamp,
    priceSeries.rows,
    sharedTimeline,
  ]);

  function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    return `${(Number(value) * 100).toFixed(2)}%`;
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatCompactNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    return Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
  }

  const context = dayDetail.context ?? {};
  const narrativeBullets = Array.isArray(context.narrative_bullets)
    ? context.narrative_bullets
    : [];
  const marketState = context.market_state ?? {};
  const externalSignalSummary = context.external_signal_summary ?? {};
  const backtracking = context.backtracking ?? {};
  const macroBacktracking = backtracking.macro ?? {};
  const mesoBacktracking = backtracking.meso ?? {};
  const inferredClusterLabel =
    marketState.cluster_id === null || marketState.cluster_id === undefined
      ? selectedClusterLabel
      : getClusterSemanticLabel(marketState.cluster_id);
  const gdeltSummary = dayDetail.gdelt_selected_day ?? {};
  const eventRows = Array.isArray(dayDetail.events_selected_day)
    ? dayDetail.events_selected_day
    : [];
  const eventRowsFullDay = Array.isArray(dayDetail.events_full_day)
    ? dayDetail.events_full_day
    : eventRows;
  const fullDayNewsCount = eventRowsFullDay.length;
  const fullDayThemeCounts = useMemo(() => {
    const counts = { regulation: 0, election: 0, war: 0 };
    eventRowsFullDay.forEach((event) => {
      const category = String(event?.category ?? '').toLowerCase();
      const headline = String(event?.headline ?? '').toLowerCase();
      if (category === 'regulation' || /\bsec\b|cftc|regulat|policy|tariff|sanction|tax/.test(headline)) {
        counts.regulation += 1;
      }
      if (category === 'election' || /election|campaign|vote|senate|congress|trump|biden|harris/.test(headline)) {
        counts.election += 1;
      }
      if (category === 'war' || /war|attack|strike|military|missile|conflict|iran|israel|ukraine|russia/.test(headline)) {
        counts.war += 1;
      }
    });
    return counts;
  }, [eventRowsFullDay]);
  const polymarketSummary = dayDetail.polymarket_selected_day ?? {};
  const polymarketMarkets = Array.isArray(polymarketSummary.markets)
    ? polymarketSummary.markets
    : [];

  return (
    <section className="view-card">
      <header className="view-header view-header-with-pin">
        <div>
          <p className="view-kicker">View 3</p>
          <h2 className="view-title">Micro Detail View</h2>
        </div>
        <PinInsightButton view="micro" />
      </header>

      <div className="summary-box">
        <p className="summary-title">Selected day</p>
        <p className="selected-date-label">{selectedDateLabel}</p>
        {!selectedDate ? (
          <p className="state-label">
            Select a date from Macro or Meso to populate the selected-day detail view.
          </p>
        ) : dayDetail.btc_detail ? (
          <>
            <p className="state-label">
              Close: {formatCurrency(dayDetail.btc_detail.close)} | Daily return:{' '}
              {formatPercent(dayDetail.btc_detail.daily_return)}
            </p>
            <p className="state-label">
              Open-close change: {formatPercent(dayDetail.btc_detail.open_close_change)}
            </p>
          </>
        ) : null}
      </div>

      <section className="placeholder-section">
        <h3 className="placeholder-title">Selected-Day Intraday Chart</h3>
        {!selectedDate ? (
          <div className="placeholder-box">
            <span className="placeholder-label">
              Select a date to load the selected-day detail chart.
            </span>
          </div>
        ) : isLoading ? (
          <div className="placeholder-box">
            <span className="placeholder-label">Loading selected-day detail...</span>
          </div>
        ) : hasDetailChart ? (
          <div className="chart-shell">
            <div
              ref={chartRef}
              className="micro-dual-grid-chart"
              role="img"
              aria-label="Dual-grid synchronized chart"
            />
            <div className="chart-caption-row">
              <p className="chart-caption">
                {priceSeries.mode === 'intraday'
                  ? `Intraday points: ${priceSeries.rows.length}`
                  : `Context window: ${dayDetail.context?.window_start} to ${dayDetail.context?.window_end}`}
              </p>
              <div className="chart-caption" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2ca02c', display: 'inline-block' }} />
                  BTC bullish candle
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#d62728', display: 'inline-block' }} />
                  BTC bearish candle
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#2f9e44', display: 'inline-block' }} />
                  GDELT tone &gt; 0.5
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#d9485f', display: 'inline-block' }} />
                  GDELT tone &lt; -0.5
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ced4da', display: 'inline-block' }} />
                  Neutral [-0.5, 0.5]
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="placeholder-box">
            <span className="placeholder-label">No selected-day window available.</span>
          </div>
        )}
      </section>

      <section className="placeholder-section">
        <h3 className="placeholder-title">Event Context &amp; Backtracking</h3>
        {selectedDate ? (
          <div className="summary-box">
            <p className="summary-title">Selected-day context</p>
            <p className="context-summary">
              {context.narrative_summary ?? 'Selected-day context is loading.'}
            </p>

            <div className="context-chip-row">
              <div className="context-chip">
                <span className="context-chip-label">Meso cluster</span>
                <strong>{inferredClusterLabel}</strong>
              </div>
              <div className="context-chip">
                <span className="context-chip-label">Move state</span>
                <strong>{marketState.move_label ?? 'Unavailable'}</strong>
              </div>
              <div className="context-chip">
                <span className="context-chip-label">Volatility</span>
                <strong>{marketState.volatility_label ?? 'Unavailable'}</strong>
              </div>
              <div className="context-chip">
                <span className="context-chip-label">Volume</span>
                <strong>{marketState.volume_label ?? 'Unavailable'}</strong>
              </div>
            </div>

            <div className="micro-context-grid">
              {narrativeBullets.length > 0 ? (
                <div className="context-section">
                  <p className="summary-title">Narrative explanation</p>
                  <ul className="context-list">
                    {narrativeBullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="context-section">
                <p className="summary-title">Backtracking anchors</p>
                <div className="context-backtracking-grid">
                  <div className="asset-context-card">
                    <p className="asset-context-ticker">Macro anchor</p>
                    <p className="asset-context-value">{macroBacktracking.month_bucket ?? 'N/A'}</p>
                    <p className="state-label">
                      Window: {macroBacktracking.window_start ?? 'N/A'} to{' '}
                      {macroBacktracking.window_end ?? 'N/A'}
                    </p>
                  </div>
                  <div className="asset-context-card">
                    <p className="asset-context-ticker">Meso anchor</p>
                    <p className="asset-context-value">
                      {mesoBacktracking.cluster_id === null || mesoBacktracking.cluster_id === undefined
                        ? selectedClusterLabel
                        : getClusterSemanticLabel(mesoBacktracking.cluster_id)}
                    </p>
                    <p className="state-label">
                      Embedding: {mesoBacktracking.embedding_x?.toFixed?.(2) ?? 'N/A'},{' '}
                      {mesoBacktracking.embedding_y?.toFixed?.(2) ?? 'N/A'}
                    </p>
                  </div>
                  <div className="asset-context-card">
                    <p className="asset-context-ticker">External breadth</p>
                    <p className="asset-context-value">
                      {externalSignalSummary.breadth_label ?? 'Unavailable'}
                    </p>
                    <p className="state-label">
                      Up {externalSignalSummary.positive_count ?? 0} | Down{' '}
                      {externalSignalSummary.negative_count ?? 0} | Flat{' '}
                      {externalSignalSummary.flat_count ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {dayDetail.external_assets.length > 0 ? (
                <div className="context-section">
                  <p className="summary-title">External asset context</p>
                  <div className="asset-context-grid">
                    {dayDetail.external_assets.map((asset) => (
                      <div key={asset.ticker} className="asset-context-card">
                        <p className="asset-context-ticker">{asset.ticker}</p>
                        <p className="asset-context-value">{formatCurrency(asset.close)}</p>
                        <p className="state-label">
                          Daily return: {formatPercent(asset.daily_return)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="asset-context-grid">
              <div className="asset-context-card">
                <p className="asset-context-ticker">Context source</p>
                <p className="asset-context-value">
                  {context.event_context_status ?? 'placeholder'}
                </p>
                <p className="state-label">
                  {context.event_context_message ??
                    'This round uses local heuristic context from BTC, features, clusters, and aligned external assets.'}
                </p>
              </div>
            </div>

            <div className="context-section">
              <p className="summary-title">Headline panel</p>
              <div className="context-chip-row">
                <div className="context-chip">
                  <span className="context-chip-label">GDELT status</span>
                  <strong>{gdeltSummary.status ?? 'placeholder'}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">News count</span>
                  <strong>{fullDayNewsCount}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">Regulation mentions</span>
                  <strong>{fullDayThemeCounts.regulation}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">Election / war mentions</span>
                  <strong>{fullDayThemeCounts.election + fullDayThemeCounts.war}</strong>
                </div>
              </div>

              {eventRows.length > 0 ? (
                <div className="headline-list">
                  {eventRows.map((event, index) => (
                    <article
                      key={`${event.url ?? event.headline}-${index}`}
                      className="headline-card"
                    >
                      <p className="headline-meta">
                        {event.source ?? 'Unknown source'} · {event.category ?? 'general'}
                        {event.timestamp ? ` · ${event.timestamp}` : ''}
                      </p>
                      {event.url ? (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="headline-link"
                        >
                          {event.headline}
                        </a>
                      ) : (
                        <p className="headline-title">{event.headline}</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="placeholder-box placeholder-box-small">
                  <span className="placeholder-label">
                    {gdeltSummary.message ??
                      'No selected-day headlines are available for the current date.'}
                  </span>
                </div>
              )}
            </div>

            <div className="context-section">
              <p className="summary-title">Headline Themes</p>
              <div className="micro-context-grid">
                <div>
                  <p className="chart-caption" style={{ marginTop: 0 }}>
                    Word cloud · size = frequency · color = mean tone
                    (green &gt; 0.5, red &lt; -0.5, grey neutral)
                  </p>
                  <HeadlineWordCloud events={eventRowsFullDay} />
                </div>
                <div>
                  <p className="chart-caption" style={{ marginTop: 0 }}>
                    ThemeRiver · stacked count of themed headlines per UTC hour
                  </p>
                  <ThemeRiverMini events={eventRows} />
                </div>
              </div>
            </div>

            <div className="context-section">
              <p className="summary-title">Polymarket context</p>
              <div className="context-chip-row">
                <div className="context-chip">
                  <span className="context-chip-label">Coverage</span>
                  <strong>{polymarketSummary.status ?? 'placeholder'}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">Window</span>
                  <strong>{polymarketSummary.bucket_label ?? 'N/A'}</strong>
                </div>
                <div className="context-chip">
                  <span className="context-chip-label">Markets shown</span>
                  <strong>{polymarketMarkets.length}</strong>
                </div>
              </div>

              {polymarketMarkets.length > 0 ? (
                <div className="polymarket-card-grid">
                  {polymarketMarkets.map((market) => (
                    <article key={market.market_slug ?? market.market_name} className="polymarket-card">
                      <p className="polymarket-card-meta">
                        {String(market.theme ?? 'market').toUpperCase()} ·{' '}
                        {market.closed ? 'RESOLVED' : 'ACTIVE'} · ENDS {String(market.end_date ?? 'N/A').slice(0, 10)}
                      </p>
                      <p className="polymarket-card-title">{market.market_name}</p>
                      <div className="polymarket-card-body">
                        <div
                          className={
                            Number(market.yes_price_at_date ?? market.current_yes_price) >= 0.5
                              ? 'polymarket-card-price is-pos'
                              : 'polymarket-card-price is-neg'
                          }
                        >
                          <span className="polymarket-card-yes">
                            {formatPercent(market.yes_price_at_date ?? market.current_yes_price)}
                          </span>
                          <span className="polymarket-card-yes-label">
                            Yes on {selectedDate ?? polymarketSummary.as_of_date ?? 'N/A'}
                          </span>
                        </div>
                        <PolymarketSparkline
                          history={Array.isArray(market.history) ? market.history : []}
                          selectedDate={selectedDate ?? polymarketSummary.as_of_date}
                        />
                      </div>
                      <p className="polymarket-card-foot">
                        Vol {formatCompactNumber(market.volume)} · {Array.isArray(market.history) ? market.history.length : 0} daily prices
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="placeholder-box placeholder-box-small">
                  <span className="placeholder-label">
                    {polymarketSummary.message ??
                      'No Polymarket context is available in the current snapshot.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="placeholder-box placeholder-box-small">
            <span className="placeholder-label">
              {selectedDate
                ? 'Event / Headlines Panel placeholder'
                : 'Select a date to inspect day context.'}
            </span>
          </div>
        )}
        {errorMessage ? <p className="state-label">Load status: {errorMessage}</p> : null}
      </section>
    </section>
  );
}
