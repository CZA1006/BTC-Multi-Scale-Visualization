import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchDayDetail } from '../api/dayDetail.js';
import { useAppStore } from '../store/useAppStore.js';
import { getClusterSemanticLabel } from '../utils/clusterLabels.js';

export function MicroView() {
  const selectedDate = useAppStore((state) => state.selectedDate);
  const selectedTimeRange = useAppStore((state) => state.selectedTimeRange);
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
  const [showAllHeadlines, setShowAllHeadlines] = useState(false);
  const [showAllPolymarket, setShowAllPolymarket] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    setShowAllHeadlines(false);
    setShowAllPolymarket(false);

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
  const timeRangeLabel = selectedTimeRange
    ? `${selectedTimeRange.start ?? 'unknown'} to ${selectedTimeRange.end ?? 'unknown'}`
    : 'No time range selected';
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
  const priceAxisBounds = getNiceAxisBounds(roundedMinPrice, roundedMaxPrice, 5);
  const maxVolume = priceSeries.rows.reduce(
    (maxValue, row) => Math.max(maxValue, Number(row.volume) || 0),
    0,
  );
  const volumeAxisBounds = getNiceAxisBounds(0, maxVolume, 4);

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
      return {
        value: point ? point.volume : 0,
        itemStyle: { color: '#5f9fd8', opacity: 0.72 },
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
        axisPointer: {
          type: 'line',
          label: { show: false },
        },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#334155',
        textStyle: { color: '#e5edf8' },
        formatter: (params) => {
          const rows = Array.isArray(params) ? params : [];
          const btc = rows.find((item) => item.seriesName === 'BTC Price');
          const volume = rows.find((item) => item.seriesName === 'Trading Volume');
          const gdelt = rows.find((item) => item.seriesName === 'News Volume');
          const timestamp =
            btc?.axisValueLabel ?? volume?.axisValueLabel ?? gdelt?.axisValueLabel ?? rows?.[0]?.axisValueLabel ?? 'N/A';
          // For candlestick, btc.data = [idx, open, close, low, high] or [O,C,L,H]; for line it's the close.
          let btcPrice = btc?.data;
          if (Array.isArray(btcPrice)) {
            btcPrice = btcPrice.length === 5 ? btcPrice[2] : btcPrice[1];
          }
          const tradingVolume = volume?.data?.value ?? 0;
          const gdeltNewsCount = gdelt?.data?.value ?? 0;
          const gdeltAvgTone = gdelt?.data?.average_tone;
          const toneLabel =
            gdeltAvgTone === null || gdeltAvgTone === undefined || Number.isNaN(Number(gdeltAvgTone))
              ? 'N/A'
              : Number(gdeltAvgTone).toFixed(2);
          const timestampText = String(timestamp);
          return [
            `${timestampText.slice(0, 10)} ${formatHourLabel(timestampText)}`,
            `BTC hourly close: ${formatCurrencyWithSymbol(btcPrice)}`,
            `Trading Volume: ${formatCompactNumber(tradingVolume)}`,
            `News Volume: ${gdeltNewsCount} articles | Avg Tone: ${toneLabel}`,
          ].join('<br/>');
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { show: false },
      },
      grid: [
        { top: '7%', height: '46%', left: '9%', right: '5%' },
        { top: '60%', height: '11%', left: '9%', right: '5%' },
        { top: '81%', height: '12%', left: '9%', right: '5%' },
      ],
      xAxis: [
        {
          type: 'category',
          gridIndex: 0,
          data: sharedTimeline,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisPointer: { label: { show: false } },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: sharedTimeline,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisPointer: { label: { show: false } },
        },
        {
          type: 'category',
          gridIndex: 2,
          data: sharedTimeline,
          axisLabel: {
            color: '#aab6cc',
            interval: 1,
            formatter: (value, index) => (index % 2 === 0 ? formatHourLabel(value) : ''),
            margin: 10,
          },
          axisPointer: { label: { show: false } },
        },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          name: 'Price (USD)',
          nameTextStyle: { color: '#aab6cc' },
          nameLocation: 'middle',
          nameRotate: 90,
          nameGap: 62,
          scale: true,
          axisLabel: {
            color: '#aab6cc',
            formatter: (value) => formatCompactNumber(value),
          },
          splitLine: { lineStyle: { color: '#263247' } },
          min: priceAxisBounds.min,
          max: priceAxisBounds.max,
          interval: priceAxisBounds.interval,
        },
        {
          type: 'value',
          gridIndex: 1,
          name: 'Trading Volume',
          nameTextStyle: { color: '#aab6cc' },
          nameLocation: 'middle',
          nameRotate: 90,
          nameGap: 44,
          axisLabel: {
            color: '#aab6cc',
            formatter: (value) => formatCompactNumber(value),
            margin: 8,
          },
          splitLine: { lineStyle: { color: '#1f2a40' } },
          min: 0,
          max: volumeAxisBounds.max,
          interval: volumeAxisBounds.interval,
        },
        {
          type: 'value',
          gridIndex: 2,
          name: 'News Count',
          nameTextStyle: { color: '#aab6cc' },
          nameLocation: 'middle',
          nameRotate: 90,
          nameGap: 44,
          axisLabel: {
            color: '#aab6cc',
            formatter: (value) => Math.round(value),
            margin: 8,
          },
          splitLine: { lineStyle: { color: '#1f2a40' } },
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
          name: 'Trading Volume',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 14,
          data: volumeData,
        },
        {
          type: 'bar',
          name: 'News Volume',
          xAxisIndex: 2,
          yAxisIndex: 2,
          barMaxWidth: 14,
          data: gdeltSeriesData,
          itemStyle: {
            color: '#9b7ef3',
            opacity: 0.78,
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
    priceAxisBounds.interval,
    priceAxisBounds.max,
    priceAxisBounds.min,
    pricePointByTimestamp,
    priceSeries.rows,
    sharedTimeline,
    volumeAxisBounds.interval,
    volumeAxisBounds.max,
  ]);

  function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    return `${(Number(value) * 100).toFixed(2)}%`;
  }

  function formatSignedPercent(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }
    const percent = Number(value) * 100;
    return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
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

  function formatCurrencyWithSymbol(value) {
    const formatted = formatCurrency(value);
    return formatted === 'N/A' ? formatted : `$${formatted}`;
  }

  function formatCompactNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'N/A';
    }

    const absValue = Math.abs(Number(value));
    const sign = Number(value) < 0 ? '-' : '';

    if (absValue >= 1_000_000_000) {
      return `${sign}${(absValue / 1_000_000_000).toFixed(absValue >= 10_000_000_000 ? 0 : 1)}B`;
    }
    if (absValue >= 1_000_000) {
      return `${sign}${(absValue / 1_000_000).toFixed(absValue >= 10_000_000 ? 0 : 1)}M`;
    }
    if (absValue >= 1_000) {
      return `${sign}${(absValue / 1_000).toFixed(absValue >= 10_000 ? 0 : 1)}K`;
    }

    return `${Number(value).toFixed(absValue < 10 ? 1 : 0)}`;
  }

  function getNiceStep(rawStep) {
    if (!Number.isFinite(rawStep) || rawStep <= 0) {
      return 1;
    }
    const exponent = Math.floor(Math.log10(rawStep));
    const base = rawStep / 10 ** exponent;
    const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
    return niceBase * 10 ** exponent;
  }

  function getNiceAxisBounds(minValue, maxValue, tickCount = 5) {
    if (
      minValue === null ||
      maxValue === null ||
      !Number.isFinite(minValue) ||
      !Number.isFinite(maxValue)
    ) {
      return { min: undefined, max: undefined, interval: undefined };
    }

    if (minValue === maxValue) {
      const fallbackStep = Math.max(Math.abs(minValue) * 0.01, 1);
      return {
        min: Math.floor((minValue - fallbackStep) / fallbackStep) * fallbackStep,
        max: Math.ceil((maxValue + fallbackStep) / fallbackStep) * fallbackStep,
        interval: fallbackStep,
      };
    }

    const span = maxValue - minValue;
    const step = getNiceStep(span / tickCount);
    return {
      min: Math.floor(minValue / step) * step,
      max: Math.ceil(maxValue / step) * step,
      interval: step,
    };
  }

  function getFallbackSevenDayVolatility() {
    const directCandidates = [
      dayDetail.btc_detail?.rolling_volatility_7d,
      dayDetail.btc_detail?.volatility_7d,
      dayDetail.btc_detail?.vol_7d,
    ];

    for (const candidate of directCandidates) {
      const parsed = Number(candidate);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    const windowRows = [...(dayDetail.btc_window ?? [])]
      .filter((row) => row?.date || row?.timestamp)
      .sort((left, right) =>
        String(left.date ?? left.timestamp).localeCompare(String(right.date ?? right.timestamp)),
      );

    let returns = windowRows
      .map((row) => Number(row.daily_return))
      .filter((value) => Number.isFinite(value));

    if (returns.length < 2) {
      const closes = windowRows
        .map((row) => Number(row.close))
        .filter((value) => Number.isFinite(value));

      returns = [];
      for (let index = 1; index < closes.length; index += 1) {
        const previous = closes[index - 1];
        const current = closes[index];
        if (previous !== 0) {
          returns.push(current / previous - 1);
        }
      }
    }

    const recentReturns = returns.slice(-7);
    if (recentReturns.length < 2) {
      return null;
    }

    const mean =
      recentReturns.reduce((sum, value) => sum + value, 0) / recentReturns.length;
    const variance =
      recentReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (recentReturns.length - 1);

    // Daily 7D volatility, not annualized. This keeps the summary interpretable
    // next to the selected day's daily return.
    return Math.sqrt(variance);
  }

  function getIntradayRange() {
    if (!dayDetail.btc_detail) {
      return null;
    }

    const highLowRange = Number(dayDetail.btc_detail.high_low_range);
    if (!Number.isNaN(highLowRange)) {
      return highLowRange;
    }

    const high = Number(dayDetail.btc_detail.high);
    const low = Number(dayDetail.btc_detail.low);
    const open = Number(dayDetail.btc_detail.open);
    if (!Number.isNaN(high) && !Number.isNaN(low) && !Number.isNaN(open) && open !== 0) {
      return (high - low) / open;
    }

    return null;
  }

  function parsePolymarketDate(row) {
    if (Array.isArray(row)) {
      const arrayDate = row[0] ?? row.date;
      const parsedArrayDate = new Date(arrayDate);
      return Number.isNaN(parsedArrayDate.getTime()) ? null : parsedArrayDate;
    }

    const rawDate =
      row?.date ??
      row?.timestamp ??
      row?.time ??
      row?.day ??
      row?.as_of_date ??
      row?.created_at ??
      row?.updated_at ??
      row?.t;

    if (!rawDate) {
      return null;
    }

    const date = new Date(rawDate);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parsePolymarketYesPrice(row) {
    if (Array.isArray(row)) {
      const arrayCandidates = [row[1], row[2], row[3]];
      for (const candidate of arrayCandidates) {
        const parsed = Number(candidate);
        if (!Number.isNaN(parsed)) {
          return parsed > 1 ? parsed / 100 : parsed;
        }
      }
    }

    const candidates = [
      row?.yes_price,
      row?.yesPrice,
      row?.yes_price_at_date,
      row?.price,
      row?.probability,
      row?.value,
      row?.p,
      row?.close,
      row?.y,
    ];

    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (!Number.isNaN(parsed)) {
        return parsed > 1 ? parsed / 100 : parsed;
      }
    }

    return null;
  }

  function getPolymarketHistoryPoints(market) {
    const history = Array.isArray(market?.history) ? market.history : [];

    return history
      .map((row) => ({
        date: parsePolymarketDate(row),
        price: parsePolymarketYesPrice(row),
      }))
      .filter((point) => point.date && point.price !== null)
      .sort((left, right) => left.date - right.date);
  }

  function getPolymarketChange(market) {
    const selectedDateText = polymarketSummary.as_of_date;
    const selectedStart = selectedDateText ? new Date(`${selectedDateText}T00:00:00`) : null;
    const selectedEnd = selectedDateText ? new Date(`${selectedDateText}T23:59:59`) : null;

    const historyPoints = getPolymarketHistoryPoints(market);

    const currentFromMarket = parsePolymarketYesPrice({
      yes_price_at_date: market?.yes_price_at_date,
    });

    const pointsUpToSelected = selectedEnd
      ? historyPoints.filter((point) => point.date <= selectedEnd)
      : historyPoints;

    const currentPoint =
      pointsUpToSelected.length > 0 ? pointsUpToSelected[pointsUpToSelected.length - 1] : null;

    const current = currentFromMarket ?? currentPoint?.price ?? null;

    const previousPoints = selectedStart
      ? historyPoints.filter((point) => point.date < selectedStart)
      : historyPoints.slice(0, -1);

    let previous =
      previousPoints.length > 0 ? previousPoints[previousPoints.length - 1].price : null;

    // Fallback: if the history does not have calendar dates before the selected day,
    // use the point immediately before the selected/current point in the provided series.
    if (previous === null && currentPoint) {
      const currentIndex = historyPoints.findIndex(
        (point) => point.date.getTime() === currentPoint.date.getTime(),
      );
      if (currentIndex > 0) {
        previous = historyPoints[currentIndex - 1].price;
      }
    }

    // Last fallback: for compact mock/cache histories, use the last two points.
    if (previous === null && historyPoints.length >= 2) {
      previous = historyPoints[historyPoints.length - 2].price;
    }

    return {
      current,
      previous,
      change: current === null || previous === null ? null : current - previous,
      historyPoints,
    };
  }

  function formatPointChange(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '1D change N/A';
    }

    const percentagePoints = Number(value) * 100;
    const sign = percentagePoints > 0 ? '+' : '';
    return `1D change ${sign}${percentagePoints.toFixed(1)} pp`;
  }

  function renderPolymarketSparkline(market, probabilityChange) {
    const points = probabilityChange.historyPoints ?? getPolymarketHistoryPoints(market);
    if (points.length < 2) {
      return (
        <div className="state-label" style={{ margin: 0 }}>
          No history
        </div>
      );
    }

    const selectedDateText = polymarketSummary.as_of_date;
    const selectedEnd = selectedDateText ? new Date(`${selectedDateText}T23:59:59`) : null;
    const visiblePoints = selectedEnd ? points.filter((point) => point.date <= selectedEnd) : points;
    const series = visiblePoints.length >= 2 ? visiblePoints : points;

    const width = 150;
    const height = 42;
    const paddingX = 5;
    const paddingY = 6;

    const currentPrice =
      probabilityChange.current ?? series[series.length - 1]?.price ?? null;
    const previousPrice = probabilityChange.previous;

    const priceValues = [
      ...series.map((point) => point.price),
      previousPrice,
      currentPrice,
    ].filter((value) => value !== null && value !== undefined && !Number.isNaN(Number(value)));

    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const spread = Math.max(maxPrice - minPrice, 0.01);

    const toX = (index) =>
      paddingX + (index / Math.max(1, series.length - 1)) * (width - paddingX * 2);
    const toY = (price) =>
      height - paddingY - ((price - minPrice) / spread) * (height - paddingY * 2);

    const fullPath = series
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(point.price)}`)
      .join(' ');

    const change = probabilityChange.change;
    const changeColor =
      change === null || Number.isNaN(Number(change))
        ? '#94a3b8'
        : change >= 0
          ? '#2ca66a'
          : '#ff5c5c';

    const currentPoint = series[series.length - 1];
    const previousIndex = Math.max(0, series.length - 2);
    const previousPoint = series[previousIndex];

    const previousY = toY(previousPrice ?? previousPoint.price);
    const currentY = toY(currentPrice ?? currentPoint.price);

    // The grey line shows the broader probability history.
    // The colored segment isolates the one-step change used in "1D change".
    const changeSegment =
      previousPrice === null || currentPrice === null
        ? null
        : `M ${toX(previousIndex)} ${previousY} L ${toX(series.length - 1)} ${currentY}`;

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Polymarket probability sparkline with highlighted latest change"
      >
        <line
          x1={paddingX}
          x2={width - paddingX}
          y1={previousY}
          y2={previousY}
          stroke="rgba(148, 163, 184, 0.28)"
          strokeDasharray="3 4"
        />
        <path
          d={fullPath}
          fill="none"
          stroke="rgba(148, 163, 184, 0.42)"
          strokeWidth="1.6"
        />
        {changeSegment ? (
          <path d={changeSegment} fill="none" stroke={changeColor} strokeWidth="3" />
        ) : null}
        <circle
          cx={toX(previousIndex)}
          cy={previousY}
          r="3"
          fill="var(--bg-2)"
          stroke="rgba(226, 232, 240, 0.75)"
          strokeWidth="1.2"
        />
        <circle
          cx={toX(series.length - 1)}
          cy={currentY}
          r="3.8"
          fill={changeColor}
        />
      </svg>
    );
  }

  const context = dayDetail.context ?? {};
  const narrativeBullets = Array.isArray(context.narrative_bullets)
    ? context.narrative_bullets
    : [];
  const marketState = context.market_state ?? {};
  const externalSignalSummary = context.external_signal_summary ?? {};
  const inferredClusterLabel =
    marketState.cluster_id === null || marketState.cluster_id === undefined
      ? selectedClusterLabel
      : getClusterSemanticLabel(marketState.cluster_id);
  const gdeltSummary = dayDetail.gdelt_selected_day ?? {};
  const eventRows = Array.isArray(dayDetail.events_selected_day)
    ? dayDetail.events_selected_day
    : [];
  const headlineThemeCounts = [
    ['War', gdeltSummary.theme_count_war ?? 0],
    ['Election', gdeltSummary.theme_count_election ?? 0],
    ['COVID', gdeltSummary.theme_count_covid ?? 0],
    ['Regulation', gdeltSummary.theme_count_regulation ?? 0],
    ['Macro', gdeltSummary.theme_count_macro ?? 0],
    ['Crypto', gdeltSummary.theme_count_crypto ?? 0],
  ]
    .map(([name, count]) => [name, Number(count)])
    .filter(([, count]) => !Number.isNaN(count) && count > 0)
    .sort((left, right) => right[1] - left[1]);

  const visibleHeadlines = showAllHeadlines ? eventRows : eventRows.slice(0, 3);
  const hiddenHeadlineCount = Math.max(0, eventRows.length - visibleHeadlines.length);

  const polymarketSummary = dayDetail.polymarket_selected_day ?? {};
  const polymarketMarkets = Array.isArray(polymarketSummary.markets)
    ? polymarketSummary.markets
    : [];
  const polymarketMarketsWithChange = polymarketMarkets
    .map((market) => ({
      ...market,
      probabilityChange: getPolymarketChange(market),
    }))
    .sort((left, right) => {
      const leftAbs = Math.abs(left.probabilityChange.change ?? 0);
      const rightAbs = Math.abs(right.probabilityChange.change ?? 0);
      if (rightAbs !== leftAbs) {
        return rightAbs - leftAbs;
      }
      return Number(right.volume ?? 0) - Number(left.volume ?? 0);
    });
  const visiblePolymarketMarkets = showAllPolymarket
    ? polymarketMarketsWithChange
    : polymarketMarketsWithChange.slice(0, 3);
  const hiddenPolymarketCount = Math.max(
    0,
    polymarketMarketsWithChange.length - visiblePolymarketMarkets.length,
  );

  const selectedDaySummaryRows = selectedDate
    ? [
        ['Close Price', formatCurrencyWithSymbol(dayDetail.btc_detail?.close)],
        [
          'Daily Return',
          `${formatPercent(dayDetail.btc_detail?.daily_return)} · ${marketState.move_label ?? 'Unavailable'}`,
        ],
        ['Intraday Range', formatPercent(getIntradayRange())],
        [
          '7D Volatility',
          `${formatPercent(getFallbackSevenDayVolatility())} · ${marketState.volatility_label ?? 'Unavailable'}`,
        ],
        ['Meso Regime', inferredClusterLabel],
        [
          'Participation',
          `${formatCompactNumber(dayDetail.btc_detail?.volume)} · ${marketState.volume_label ?? 'Unavailable'}`,
        ],
      ]
    : [];

  return (
    <section className="view-card">
      <header className="view-header">
        <div>
          <p className="view-kicker">View 3</p>
          <h2 className="view-title">Micro Detail View: Explain a Selected Day</h2>
        </div>
      </header>

      <div className="summary-box">
        <p className="summary-title">{selectedDate ? `${selectedDate} Summary` : 'Selected Day Summary'}</p>
        {!selectedDate ? (
          <p className="state-label">
            Select a date from Macro or Meso to populate the selected-day detail view.
          </p>
        ) : dayDetail.btc_detail ? (
          <div className="micro-summary-grid">
            {selectedDaySummaryRows.map(([label, value]) => {
              const textValue = String(value ?? 'N/A');
              const [primaryValue, secondaryValue] = textValue.includes(' · ')
                ? textValue.split(' · ', 2)
                : [textValue, null];
              return (
                <div key={label} className="micro-summary-card">
                  <span className="micro-summary-label">{label}</span>
                  <strong className="micro-summary-primary">{primaryValue}</strong>
                  {secondaryValue ? <span className="micro-summary-secondary">{secondaryValue}</span> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="state-label">Loading selected-day summary...</p>
        )}
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
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 16,
                marginBottom: 8,
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: '#2ca02c',
                  }}
                />
                BTC up candle
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: '#d62728',
                  }}
                />
                BTC down candle
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: '#5f9fd8',
                  }}
                />
                Volume
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: '#9b7ef3',
                  }}
                />
                News volume
              </span>
            </div>
            <div
              ref={chartRef}
              className="micro-dual-grid-chart"
              role="img"
              aria-label="BTC price, trading volume, and news volume chart"
              style={{ minHeight: 500 }}
            />
          </div>
        ) : (
          <div className="placeholder-box">
            <span className="placeholder-label">No selected-day window available.</span>
          </div>
        )}
      </section>

      <section className="placeholder-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h3 className="placeholder-title" style={{ margin: 0 }}>
            Event Context &amp; Backtracking
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="chart-range-pill">{timeRangeLabel}</span>
            {selectedDate ? (
              <span className="chart-range-pill">{selectedDate}</span>
            ) : null}
          </div>
        </div>
        {selectedDate ? (
          <div className="summary-box">
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

              {dayDetail.external_assets.length > 0 ? (
                <div className="context-section">
                  <p className="summary-title">External asset context</p>
                  <p className="state-label" style={{ marginTop: -4, marginBottom: 12 }}>
                    {externalSignalSummary.breadth_label ?? 'External asset breadth unavailable'} ·
                    Up {externalSignalSummary.positive_count ?? 0} | Down{' '}
                    {externalSignalSummary.negative_count ?? 0} | Flat{' '}
                    {externalSignalSummary.flat_count ?? 0}
                  </p>
                  <div className="asset-context-grid">
                    {dayDetail.external_assets.map((asset) => {
                      const assetReturn = Number(asset.daily_return);
                      const returnColor = Number.isNaN(assetReturn)
                        ? 'var(--text-main)'
                        : assetReturn >= 0
                          ? '#2ca66a'
                          : '#ff5c5c';
                      return (
                        <div
                          key={asset.ticker}
                          className="asset-context-card"
                          style={{
                            minHeight: 118,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <p className="asset-context-ticker">{asset.ticker}</p>
                            <p
                              className="asset-context-value"
                              style={{
                                color: returnColor,
                                fontSize: '1.5rem',
                                lineHeight: 1.1,
                              }}
                            >
                              {formatSignedPercent(asset.daily_return)}
                            </p>
                          </div>
                          <p className="state-label" style={{ margin: 0 }}>
                            Close: {formatCurrencyWithSymbol(asset.close)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="context-section">
              <p className="summary-title">Headline panel</p>
              {gdeltSummary.bucket_label ? (
                <p className="state-label">
                  GDELT bucket · <strong>{gdeltSummary.bucket_label}</strong>
                  {' '}— curated query routes the DOC API toward this window's narrative.
                </p>
              ) : null}
              <div
                className="asset-context-card"
                style={{
                  marginTop: 10,
                  marginBottom: 14,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <p className="asset-context-ticker" style={{ marginBottom: 4 }}>
                      Top themes
                    </p>
                    <p className="state-label" style={{ margin: 0 }}>
                      Theme mention count in the selected context window.
                    </p>
                  </div>
                </div>

                {headlineThemeCounts.length > 0 ? (
                  <div className="theme-compact-wrap">
                    {(() => {
                      const topThemes = headlineThemeCounts.slice(0, 4);
                      const maxThemeCount = Math.max(...topThemes.map(([, count]) => Number(count)), 1);
                      const themeColors = {
                        Crypto: '#66c2a5',
                        Regulation: '#e78ac3',
                        War: '#d65a5a',
                        Election: '#8da0cb',
                        Macro: '#f7931a',
                        COVID: '#ffd92f',
                      };

                      return topThemes.map(([name, count], index) => {
                        const numericCount = Number(count);
                        const sizeRatio = numericCount / maxThemeCount;
                        const size = 0.78 + sizeRatio * 0.22;
                        const accent = themeColors[name] ?? '#94a3b8';
                        return (
                          <span
                            key={name}
                            className="theme-compact-item"
                            style={{
                              fontSize: `${size}rem`,
                              borderColor: `${accent}55`,
                              background: `${accent}1a`,
                              opacity: 0.95 - index * 0.07,
                            }}
                          >
                            <span className="theme-compact-label" style={{ color: accent }}>{name}</span>
                          </span>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p className="state-label" style={{ margin: 0 }}>
                    No theme mentions available.
                  </p>
                )}
              </div>

              {eventRows.length > 0 ? (
                <>
                  <div className="headline-list">
                    {visibleHeadlines.map((event, index) => (
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

                  {eventRows.length > 3 ? (
                    <button
                      type="button"
                      className="range-button"
                      style={{ marginTop: 12 }}
                      onClick={() => setShowAllHeadlines((previous) => !previous)}
                    >
                      {showAllHeadlines
                        ? 'Show fewer'
                        : `Show more (${hiddenHeadlineCount} more)`}
                    </button>
                  ) : null}
                </>
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 10,
                }}
              >
                <div>
                  <p className="summary-title" style={{ marginBottom: 4 }}>
                    Polymarket expectation shifts on {polymarketSummary.as_of_date ?? 'N/A'}
                  </p>
                  <p className="state-label" style={{ margin: 0 }}>
                    Grey line = recent probability history; colored last segment = 1D change.
                  </p>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    color: 'var(--text-muted)',
                    fontSize: '0.74rem',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 18,
                        height: 3,
                        borderRadius: 999,
                        background: '#2ca66a',
                      }}
                    />
                    probability up
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 18,
                        height: 3,
                        borderRadius: 999,
                        background: '#ff5c5c',
                      }}
                    />
                    probability down
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 18,
                        height: 0,
                        borderTop: '2px dashed rgba(148, 163, 184, 0.45)',
                      }}
                    />
                    previous level
                  </span>
                </div>
              </div>

              {polymarketMarketsWithChange.length > 0 ? (
                <>
                  <div className="polymarket-card-grid">
                    {visiblePolymarketMarkets.map((market) => {
                      const yesAt = market.probabilityChange.current;
                      const change = market.probabilityChange.change;
                      const hasChange =
                        change !== null && change !== undefined && !Number.isNaN(Number(change));
                      const cardColor = !hasChange
                        ? 'var(--text-muted)'
                        : change >= 0
                          ? '#2ca66a'
                          : '#ff5c5c';

                      return (
                        <article
                          key={market.market_slug ?? market.market_name}
                          className="polymarket-card"
                        >
                          <p className="polymarket-card-meta">
                            {market.theme ?? 'market'} ·{' '}
                            {market.closed ? 'resolved' : 'live'} · ends{' '}
                            {market.end_date ? market.end_date.slice(0, 10) : 'N/A'}
                          </p>
                          <p className="polymarket-card-title">{market.market_name}</p>
                          <div className="polymarket-card-body">
                            <div className="polymarket-card-price">
                              <span
                                className="polymarket-card-yes"
                                style={{ color: cardColor }}
                              >
                                {formatPercent(yesAt)}
                              </span>
                              <span
                                className="polymarket-card-yes-label"
                                style={{ color: cardColor, fontWeight: 700 }}
                              >
                                {formatPointChange(change)}
                              </span>
                              <span className="polymarket-card-yes-label">
                                {market.yes_label ?? 'Yes'} on{' '}
                                {polymarketSummary.as_of_date ?? '—'}
                              </span>
                            </div>
                            {renderPolymarketSparkline(market, market.probabilityChange)}
                          </div>
                          <p className="polymarket-card-foot">
                            Vol {formatCurrency(market.volume)} ·{' '}
                            {(market.history?.length ?? 0)} daily prices
                          </p>
                        </article>
                      );
                    })}
                  </div>

                  {polymarketMarketsWithChange.length > 3 ? (
                    <button
                      type="button"
                      className="range-button"
                      style={{ marginTop: 12 }}
                      onClick={() => setShowAllPolymarket((previous) => !previous)}
                    >
                      {showAllPolymarket
                        ? 'Show fewer'
                        : `Show more (${hiddenPolymarketCount} more)`}
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="placeholder-box placeholder-box-small">
                  <span className="placeholder-label">
                    {polymarketSummary.message ??
                      'No Polymarket coverage for this date.'}
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
