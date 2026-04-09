import React from 'react';
import { MacroView } from './views/MacroView.jsx';
import { MesoView } from './views/MesoView.jsx';
import { MicroView } from './views/MicroView.jsx';

export default function App() {
  return (
    <main className="app-shell">
      <header className="title-bar">
        <div>
          <p className="app-eyebrow">Coordinated Multi-View Dashboard</p>
          <h1 className="app-title">BTC Multi-Scale Visualization</h1>
        </div>
        <p className="app-subtitle">
          Macro overview, meso pattern discovery, and micro detail are arranged as a
          clear vertical workflow for later D3-based views.
        </p>
      </header>

      <section className="dashboard-stack">
        <div className="dashboard-section">
          <MacroView />
        </div>
        <div className="dashboard-section">
          <MesoView />
        </div>
        <div className="dashboard-section">
          <MicroView />
        </div>
      </section>
    </main>
  );
}
