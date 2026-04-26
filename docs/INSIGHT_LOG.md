# Insight Log

The dashboard ships with a built-in **insight pinning** feature (P7). Every
view (Macro / Meso / Micro) has a "📌 Pin insight" button in its header.
Clicking it opens a small modal that captures:

- the originating view (`macro` | `meso` | `micro`),
- the current `selectedTimeRange` (`{start, end}`),
- the currently `selectedDate` (or `null`),
- the currently `selectedCluster` (or `null`),
- a free-text observation typed by the user.

The pinned insight is saved to `localStorage` (key:
`btc-multi-scale.insights.v1`) and surfaced in a slide-in panel toggled by
the **Insights** pill in the title-bar. From the panel users can:

- **Restore context** — click any pinned row to reset the live store back
  to the time range / date / cluster captured when the insight was made.
- **Export JSON** — download all pinned insights as
  `insights-YYYY-MM-DD.json`.
- **Clear all** — wipe the log (with confirmation).

This document describes the schema, holds *seed* insights from the design
team's own walkthroughs, and provides the synthesis template the user-study
facilitator fills after running participants.

---

## 1. Schema

A pinned insight is one record in the JSON array:

```json
{
  "id": "ins_lr3f2k_a8c91d",
  "createdAt": "2026-04-25T14:08:33.012Z",
  "view": "macro",
  "range": { "start": "2020-02-01", "end": "2020-06-30" },
  "date": "2020-03-12",
  "cluster": 0,
  "note": "Heatmap shows the deepest red cell in the COVID window on 2020-03-12, \"Black Thursday\" — eclipsed even the 2020-03-09 selloff."
}
```

### Field semantics

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unguessable opaque id (`ins_<base36 ts>_<rand>`); used for delete + restore. |
| `createdAt` | ISO-8601 string | Set client-side when Save is pressed. |
| `view` | `'macro' \| 'meso' \| 'micro' \| null` | Which view the user pinned from. |
| `range` | `{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } \| null` | Captured `selectedTimeRange` at pin time. |
| `date` | `'YYYY-MM-DD' \| null` | Captured `selectedDate`. |
| `cluster` | integer \| `null` | Captured `selectedCluster` (cluster id). |
| `note` | string | Free text; trimmed; required (empty notes are not saved). |

### Stability promise

The `v1` suffix in the storage key reserves the right to break the schema
in a future iteration. Any breaking change should:

1. Bump the key to `btc-multi-scale.insights.v2`.
2. Migrate or discard `v1` data on first read of `v2`.
3. Update this document and `HEURISTIC_EVALUATION.md`.

---

## 2. Seed insights — design team walkthroughs

Three pre-pinned examples from the design team using the dashboard during
P5–P7 development. Participants in the user study can be shown these as
reference for what "good" insights look like — *concrete*, *cite a visual
encoding*, *say why it matters*.

```json
[
  {
    "id": "ins_seed_01",
    "createdAt": "2026-04-23T10:11:00.000Z",
    "view": "macro",
    "range": { "start": "2020-02-01", "end": "2020-06-30" },
    "date": "2020-03-12",
    "cluster": null,
    "note": "Black Thursday is the single deepest cell in the heatmap for the COVID window. The horizon graph shows the 7d rolling return going to its strongest red band the same week — confirming this is not an isolated bar but the start of a regime shift."
  },
  {
    "id": "ins_seed_02",
    "createdAt": "2026-04-23T10:18:00.000Z",
    "view": "meso",
    "range": { "start": "2022-02-01", "end": "2022-05-31" },
    "date": "2022-02-24",
    "cluster": 2,
    "note": "Invasion day lands in the same cluster (Risk-Off) as a cluster of 2020 panic days — visible because the regime summary table sorts by mean return, and the war-window days share the bottom row's negative equity-curve sparkline shape."
  },
  {
    "id": "ins_seed_03",
    "createdAt": "2026-04-23T10:24:00.000Z",
    "view": "micro",
    "range": { "start": "2024-09-01", "end": "2025-01-31" },
    "date": "2024-11-06",
    "cluster": 4,
    "note": "Election-day word cloud is dominated by 'trump' + 'crypto' + 'etf' — the theme river also shows the crypto + election bands swelling in the early-evening hours. The candle is clearly green, confirming policy-pivot priced in."
  }
]
```

These three are *committed* to the repo as seed examples. Participants
start with an empty `localStorage`, so the seed list does not pollute their
own pins; the seeds live here as documentation only.

---

## 3. What makes a "good" pinned insight

For the user study, score insights against this rubric:

| Criterion | Description |
|---|---|
| **Concrete** | References a specific date, cluster, value, or visual mark. |
| **Mechanistic** | Names the encoding that surfaced it ("the deepest heatmap cell", "the horizon's strongest band", "the SPLOM cell where return × volatility splits cleanly"). |
| **Causal or comparative** | Either explains *why* (event-context overlay) or *compares* against another window/cluster. |
| **Falsifiable** | A reader could re-open the dashboard with the same range/date/cluster and check the claim. |

A rough scoring band:

- **3 pts** — meets all four criteria.
- **2 pts** — concrete + mechanistic.
- **1 pt** — concrete only.
- **0 pts** — vague (e.g. "looks interesting").

---

## 4. Synthesized findings *(fill after user study)*

> Replace the placeholders below once the n = 4–5 sessions complete and
> all `insights-P*-*.json` exports are in `data/user-study/`.

### 4.1 Aggregate metrics

| Metric | Target | Observed |
|---|---|---|
| Total participants | 4–5 | _TBD_ |
| Total insights pinned | ≥ 24 | _TBD_ |
| Mean insights per participant | ≥ 6 | _TBD_ |
| Mean SUS-10 score | ≥ 70 | _TBD_ |
| Tasks completed (success rate) | ≥ 80 % | _TBD_ |

### 4.2 Patterns observed *(top 3, each shared by ≥ 2 participants)*

1. _TBD_
2. _TBD_
3. _TBD_

### 4.3 Common confusions *(top 3 with severity 1–4)*

| # | Confusion | Severity | Heuristic touched |
|---|---|---|---|
| 1 | _TBD_ | _ | _ |
| 2 | _TBD_ | _ | _ |
| 3 | _TBD_ | _ | _ |

### 4.4 Feature requests *(verbatim quotes)*

- _TBD_
- _TBD_

### 4.5 Heuristic-eval refresh

After synthesis, revisit `docs/HEURISTIC_EVALUATION.md` §2 and re-rate any
finding whose severity moved (up or down) based on observed participant
behavior. Add new findings discovered only in the study to the same table
with a `S#` id and link them back here.

---

## 5. How to read an exported JSON file

```bash
# Pretty-print
jq . insights-P1-2026-04-25.json

# Count by view
jq 'group_by(.view) | map({ view: .[0].view, count: length })' insights-P1-*.json

# Pull all notes containing a keyword
jq -r '.[] | select(.note | test("regulation"; "i")) | "\(.date)  \(.note)"' insights-*.json
```

For analysis at the cohort level, concatenate all participant exports:

```bash
jq -s 'add' data/user-study/insights-P*-*.json > data/user-study/all-insights.json
```

---

*Last updated: end of P7. The seed insights in §2 are stable; the
synthesis in §4 is a template waiting on study data.*
