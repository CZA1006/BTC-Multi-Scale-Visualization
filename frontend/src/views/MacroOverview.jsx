import { useEffect, useState } from 'react';
import { fetchOverview } from '../api/overview.js';
import { CalendarHeatmap } from '../components/CalendarHeatmap.jsx';
import { MetricStrip } from '../components/MetricStrip.jsx';
import { Panel } from '../components/Panel.jsx';
import { TimelineChart } from '../components/TimelineChart.jsx';
import { useAppStore } from '../store/useAppStore.js';

export function MacroOverview() {
  const setSelectedTimeRange = useAppStore((state) => state.setSelectedTimeRange);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      const data = await fetchOverview();
      if (cancelled) {
        return;
      }
      setOverview(data);
      setSelectedTimeRange({
        start: data.metadata.start_date,
        end: data.metadata.end_date,
      });
      setLoading(false);
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [setSelectedTimeRange]);

  if (loading || !overview) {
    return (
      <main className="app-shell">
        <section className="hero">
          <p className="eyebrow">BTC Multi-Scale Visualization</p>
          <h1>Loading macro overview...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">BTC Multi-Scale Visualization</p>
          <h1>Macro overview scaffold for timeline-first exploration.</h1>
          <p className="hero-copy">
            This MVP starts with the stable workflow in the project contract:
            overview first, then meso patterns, then selected-day detail.
          </p>
        </div>
        <div className="hero-callout">
          <span>Data source</span>
          <strong>{overview.metadata.data_source}</strong>
          <small>
            {overview.metadata.uses_placeholder
              ? 'Rendering placeholder-backed output.'
              : 'Rendering local CSV output from the backend pipeline.'}
          </small>
        </div>
      </section>

      <MetricStrip
        summary={overview.summary}
        assets={overview.assets}
        metadata={overview.metadata}
      />

      <div className="panel-stack">
        <Panel
          eyebrow="Macro"
          title="BTC Timeline"
          subtitle="Long-range price scaffold for the brushing interaction that will drive later views."
        >
          <TimelineChart series={overview.series} />
        </Panel>

        <Panel
          eyebrow="Macro"
          title="Calendar Heatmap"
          subtitle="Daily-return shell for spotting volatility bursts and extreme-day clusters at a glance."
        >
          <CalendarHeatmap calendar={overview.calendar} />
        </Panel>
      </div>
    </main>
  );
}
