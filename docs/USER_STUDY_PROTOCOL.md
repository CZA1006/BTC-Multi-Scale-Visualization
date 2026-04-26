# User Study Protocol — BTC Multi-Scale Visualization

A small-n formative evaluation (n = 4–5) intended to surface comprehension
gaps, confirm task feasibility, and produce an *insight count per task* that
we report alongside the heuristic evaluation. This is **not** a controlled
between-subjects experiment — it is a think-aloud usability study.

---

## 1. Goals

1. Confirm that the five canonical tasks (§4) can each be completed in
   ≤ 3 minutes by a participant with light finance background.
2. Capture an **insight count per participant per task** using the in-app
   insight-log feature, then compare against a target.
3. Surface confusion points, mis-encodings, or layout problems we missed in
   the heuristic evaluation.
4. Get a System Usability Scale (SUS-10) reading.

This is intentionally lightweight: 30 minutes per session, no audio
recording, no video — just notes from the facilitator and the participant's
own pinned insights as the artifact.

---

## 2. Participants

- **Target n** — 4 or 5 classmates from MSBD5005 or peers with comparable
  background (one course in stats/finance, comfortable with line charts and
  scatterplots).
- **Recruitment** — invite via class chat; offer a coffee voucher.
- **Exclusion** — anyone who has already used the dashboard for ≥ 5 minutes
  (we want first-encounter behavior).
- **Compensation** — token-only; this is a course exercise, not a paid study.

We do not aim for statistical significance. Five sessions is the canonical
"useful" sample for formative usability studies *(Nielsen, 2000)*.

---

## 3. Setup

### Hardware
- 13"–16" laptop, external mouse optional, single screen.
- Browser: Chrome or Safari, latest stable.
- Frontend running on `localhost:5173` against the cached backend on `localhost:8000`.

### Pre-session checklist
- [ ] Backend `uvicorn` process up; `/api/overview` returns 200.
- [ ] Frontend `npm run dev` up; full reload works.
- [ ] localStorage cleared (so each participant starts with an empty
      insight log). In DevTools console: `localStorage.removeItem('btc-multi-scale.insights.v1')`.
- [ ] Browser zoom at 100%.
- [ ] Network tab open, no throttling.
- [ ] Facilitator note sheet (printout of §6 score sheet).

### Consent + intro (4 min)
> "Thanks for helping out. We're testing a Bitcoin market dashboard for our
> visualization course — we want to see whether the design helps people
> spot patterns, not whether *you* know finance. You'll do five short tasks.
> Please *think aloud* as you work — say what you're looking for, what
> confuses you. There are no wrong answers; if something is unclear, that's
> useful data for us. We'll save the insights you flag along the way; at
> the end I'll ask 10 quick questions. The whole thing takes about 30
> minutes. May I take written notes?"

If they consent, proceed. No audio/video.

---

## 4. Task script

Each task: read the prompt verbatim, then start a timer. Stop the timer when
the participant says "I'm done" *or* hits the 3-minute soft cap. After each
task, prompt them to **pin an insight** capturing what they found.

### Task 1 — Worst single day for BTC in 2020

> "Find the single day in 2020 where BTC had the largest negative daily
> return. Tell me the date, and pin an insight describing what you noticed
> about that day."

- **Expected path** — Macro view → click "Full Range" or brush 2020 →
  scroll the calendar heatmap → spot the deepest red cell → click → confirm
  in the timeline.
- **Success criterion** — identifies 2020-03-12 ("Black Thursday").
- **Time-on-task target** — ≤ 90 s.
- **Insight target** — 1.

### Task 2 — Dominant regime during the war window

> "Switch to the War Regime case study. Which market regime dominated the
> first week of the invasion? Pin an insight about how you can tell."

- **Expected path** — Click "War Regime" case study → narrative auto-plays →
  Meso view's regime summary table → identify the cluster with most days.
- **Success criterion** — names the regime (e.g. *Volatile Recovery* or
  *Risk-Off*) and points to *either* the cluster swatch in the scatter or
  the n-column in the summary table.
- **Time-on-task target** — ≤ 120 s.
- **Insight target** — 1.

### Task 3 — Correlation in panic vs. calm

> "Compare the BTC ↔ QQQ 30-day correlation in the COVID Shock window vs.
> in the Election Cycle window. Which window has the higher correlation?
> Pin an insight."

- **Expected path** — Apply COVID case study → read the KPI ticker's
  "30d Corr · QQQ" card *or* the Meso correlation matrix → switch to
  Election → compare.
- **Success criterion** — names which is higher (typically COVID) and cites
  *either* the KPI card or the matrix cell.
- **Time-on-task target** — ≤ 150 s.
- **Insight target** — 1.

### Task 4 — High-news day in the Iran window

> "Pick a day in the Iran Tension window where the news volume was high.
> Open the Micro view for that day. What's the dominant theme in the word
> cloud? Pin an insight."

- **Expected path** — Iran case study → narrative or manual heatmap drill →
  pick a high-event day (e.g. 2026-03-26) → scroll to Micro → read word
  cloud + theme river.
- **Success criterion** — picks a day with `news_count ≥ 5` *and* names the
  dominant theme (war / regulation / crypto / election / other).
- **Time-on-task target** — ≤ 150 s.
- **Insight target** — 1.

### Task 5 — Run the COVID narrative end-to-end

> "Run the COVID Shock narrative from start to finish (use the Next button
> or the right-arrow key). Pin an insight at each step describing what the
> spotlit view is showing you."

- **Expected path** — COVID case study → narrative starts → Next through
  3 steps → pin one insight per step.
- **Success criterion** — completes all 3 steps without exiting; pins ≥ 3
  insights.
- **Time-on-task target** — ≤ 180 s.
- **Insight target** — 3.

---

## 5. Post-task questionnaire

### Open-ended (5 min)
1. *What was the most useful element of the dashboard for you?*
2. *What was the most confusing element?*
3. *Was there anything you wanted to do but couldn't figure out how?*
4. *Did the green/red color convention feel right?*

### SUS-10 (4 min)

Standard System Usability Scale; rate 1 (strongly disagree) to 5 (strongly
agree).

1. I think that I would like to use this dashboard frequently.
2. I found the dashboard unnecessarily complex.
3. I thought the dashboard was easy to use.
4. I think that I would need the support of a technical person to be able to use this dashboard.
5. I found the various functions in this dashboard were well integrated.
6. I thought there was too much inconsistency in this dashboard.
7. I would imagine that most people would learn to use this dashboard very quickly.
8. I found the dashboard very cumbersome to use.
9. I felt very confident using the dashboard.
10. I needed to learn a lot of things before I could get going with this dashboard.

Score: convert per `(odd) - 1` and `5 - (even)`, sum, multiply by 2.5.
68 = average; 80+ = good.

### Insight-log export

At the end of each session: open the Insight panel → **Export JSON** →
save as `insights-P{participant#}-{YYYY-MM-DD}.json` in `data/user-study/`.

---

## 6. Scoring rubric (one row per participant)

| Task | Success (Y/N) | Time (s) | Insights pinned | Notes |
|---|---|---|---|---|
| T1 — Worst day 2020 | | | | |
| T2 — War regime | | | | |
| T3 — Corr COVID vs Election | | | | |
| T4 — Iran high-news theme | | | | |
| T5 — COVID narrative | | | | |

| SUS-10 score | _ / 100 |
|---|---|
| Total insights pinned | |
| Total session time | |
| Catastrophic confusions | |

### Aggregate target (across n = 4–5)

- ≥ 80 % task success across all participants.
- Average time-on-task within the per-task targets above.
- Average SUS ≥ 70.
- Average insight count ≥ 6 (one per task + extras during T5).

---

## 7. Synthesis

After all sessions, fill the corresponding section in
`docs/INSIGHT_LOG.md`:

- *Patterns observed* — three 1-sentence findings shared by ≥ 2 participants.
- *Common confusions* — the top three with severity rating.
- *Feature requests* — verbatim quotes; flag any that are out of demo scope.
- *Heuristic-eval refresh* — re-rate any Nielsen item whose severity moved.

Pinned-insight JSON exports are committed to
`data/user-study/insights-P*-*.json` so the artifact set is reproducible.

---

## 8. Ethical notes

- No personally identifiable information is recorded.
- Participants can withdraw at any time and ask for their session's data
  to be deleted.
- The insight-log export contains only their on-screen observations and
  the time-range / cluster / date context the dashboard was in — no system
  metadata, no IP, no headers.

---

*Protocol authored at end of P7. Run results to be appended in
`INSIGHT_LOG.md` once sessions complete.*
