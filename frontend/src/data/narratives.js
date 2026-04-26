// Authored case-study narratives for the martini-glass shell.
// Each narrative is a 3-step linear sequence: establishing → highlight → release.
// Steps mutate the shared store via setNarrative/advanceNarrative.

export const NARRATIVES = {
  covid: {
    id: 'covid',
    title: 'COVID Shock',
    steps: [
      {
        id: 'covid-1',
        title: 'Establishing shot',
        body:
          'In Feb 2020, BTC trades sideways near $10k as the WHO declares COVID-19 a pandemic on March 11. Risk assets are pricing in early uncertainty.',
        state: {
          selectedTimeRange: { start: '2020-02-01', end: '2020-06-30' },
          selectedDate: null,
          selectedCluster: null,
        },
        spotlight: 'macro',
      },
      {
        id: 'covid-2',
        title: 'Black Thursday',
        body:
          'On March 12, BTC drops roughly –40% in 24 hours alongside global risk-off panic. Note the volume spike and bearish candle in the intraday chart.',
        state: { selectedDate: '2020-03-12' },
        spotlight: 'micro',
      },
      {
        id: 'covid-3',
        title: 'Free exploration',
        body:
          'Now you take the lead — brush April–June on Macro to see the rebound, switch to the Parallel Coords or SPLOM tab in Meso, or click headlines in Micro.',
        state: {},
        spotlight: null,
      },
    ],
  },

  war: {
    id: 'war',
    title: 'War Regime',
    steps: [
      {
        id: 'war-1',
        title: 'Establishing shot',
        body:
          'Russia invades Ukraine on Feb 24, 2022. Risk-off cascades through equities and crypto in parallel.',
        state: {
          selectedTimeRange: { start: '2022-02-01', end: '2022-05-31' },
          selectedDate: null,
          selectedCluster: null,
        },
        spotlight: 'macro',
      },
      {
        id: 'war-2',
        title: 'Invasion day',
        body:
          'BTC opens near $38k and sells off through the war-headline burst. Watch the news-volume bar light up under the candlestick.',
        state: { selectedDate: '2022-02-24' },
        spotlight: 'micro',
      },
      {
        id: 'war-3',
        title: 'Free exploration',
        body:
          'Compare BTC vs COIN/MSTR/QQQ in this window — does crypto behave like a tech stock or a safe-haven here?',
        state: {},
        spotlight: null,
      },
    ],
  },

  election: {
    id: 'election',
    title: 'Election Cycle',
    steps: [
      {
        id: 'election-1',
        title: 'Establishing shot',
        body:
          'The run-up to the November 2024 U.S. election and the first weeks of the policy reaction window.',
        state: {
          selectedTimeRange: { start: '2024-09-01', end: '2025-01-31' },
          selectedDate: null,
          selectedCluster: null,
        },
        spotlight: 'macro',
      },
      {
        id: 'election-2',
        title: 'Day after the vote',
        body:
          'Nov 6, 2024 — BTC clears $75k for the first time on policy-pivot expectations. Tone of headlines flips noticeably positive.',
        state: { selectedDate: '2024-11-06' },
        spotlight: 'micro',
      },
      {
        id: 'election-3',
        title: 'Free exploration',
        body:
          'Drill into the Meso embedding to see whether the election-week regime is a unique cluster or a known volatility pattern.',
        state: {},
        spotlight: 'meso',
      },
    ],
  },

  iran: {
    id: 'iran',
    title: 'Iran Tension',
    steps: [
      {
        id: 'iran-1',
        title: 'Establishing shot',
        body:
          'Recent Middle East tension window — GDELT live coverage available, so you can see real headline data.',
        state: {
          selectedTimeRange: { start: '2026-03-01', end: '2026-04-09' },
          selectedDate: null,
          selectedCluster: null,
        },
        spotlight: 'macro',
      },
      {
        id: 'iran-2',
        title: 'Tension spike',
        body:
          'On 2026-03-26 the news-volume bars below the candlestick surge red. Word cloud lights up with war-themed terms.',
        state: { selectedDate: '2026-03-26' },
        spotlight: 'micro',
      },
      {
        id: 'iran-3',
        title: 'Free exploration',
        body:
          'Now explore: does the cluster on this day match earlier war-regime days? Try the SPLOM and watch volatility vs return.',
        state: {},
        spotlight: 'meso',
      },
    ],
  },
};
