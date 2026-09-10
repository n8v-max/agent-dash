Type: implementation
Status: ready-for-agent
Blocked by: 62, 65
Label: ready-for-agent

# Fixture: window to 25 Sep, one to nine sessions per Member per workday, spend as a smooth function of time

## Goal

The dataset runs **12 Apr – 25 Sep 2026** and is busy: on a typical workday each human Member
runs between one and nine root sessions. Weekly session spend is a function of time — modest and
noisy from April, then rising, and from July on it fluctuates within ±20% of its trend. The seat
fee stops being the sharpest finding; the spec says so instead of pretending otherwise.

Decided by the human, 2026-09-10 (confirmed: per human Member, ~8,000 roots).

## What exists today

- `src/fixtures/targets.mts` — `WINDOW_END_DAY = 2026-09-08`, `WINDOW_DAYS = 150`, `RAMP`
  (median 0 → 2 sessions per Member per **week**), `SEAT_SHARE_RANGE` 0.44–0.52,
  `MEDIAN_SESSION_COST_RANGE`, `CHILD_*`.
- `src/fixtures/schedule.mts` — weekly Poisson per Member, weekday-weighted day pick.
- Committed data: 742 roots, 1,049 rows; org-wide median 5 roots per day; weekly session cost
  swings 54 → 373 → 135 between adjacent weeks.
- Spec R-D2, R-D3, R-D4 (and the R-D4 collision note), fixture README figures, README figures,
  ADR-0009 (what changes at scale — cites current row counts).
- `organization.json` `window_end` / `window_days` are read by the app (ticket 62 cuts at now).

## Scope

1. **Window.** `WINDOW_END_DAY = 2026-09-25`, `WINDOW_DAYS = 167`; DST check still passes (no
   transition until 25 Oct). `organization.json` follows.
2. **Volume.** Replace the weekly ramp with a **daily** model per human Member: on a workday,
   sessions ~ 1 + Poisson(λ(t)·activity), capped at 9, with λ rising from ~1.5 in April to ~4 in
   September; weekends at 15% of the weekday rate; one Member (R-D10) stays near-idle
   (`LOW_USAGE_SESSIONS` may rise to ≤ 12 across the window — still "fewer than 1% of a peer's").
   Service accounts keep their own schedules, scaled ×3. Target ≈ 7,500–8,500 roots; children
   stay at `CHILD_ROOT_SHARE` 0.2.
3. **Spend curve.** Author `WEEKLY_SPEND_SHAPE`: a smooth target for weekly session cost (a
   logistic ramp from ~$450/week in April to a plateau in August–September), and a tolerance
   band: weeks whose first day is before 1 July within ±40% of the curve, weeks from 1 July
   within **±20%**. The generator repairs toward the curve by scaling that week's token draws
   (not by moving sessions) and asserts the band. Costs are "more modest initially" by
   construction of the ramp; do not add a separate price ramp.
4. **Targets that change meaning.** `SEAT_SHARE_RANGE` becomes a *ceiling* (≤ 0.25) and
   `MEDIAN_SESSION_COST_RANGE` is deleted here (ticket 68 sets the token/cost distribution).
   Keep R-D6/R-D7 acceptance marginals, R-D8 rates, R-D11–R-D15, R-D19, R-D21 as they are.
5. **Spec and docs.** R-D2 → new dates and day count; R-D3 → new counts; R-D4 rewritten: "volume
   is one to nine root sessions per human Member per workday, ramping from April; the seat fee is
   a minor share of Total spend". Strike the R-D4 collision paragraph (moot). README, fixture
   README, ADR-0009 numbers updated. Landing figures are hardcoded by ticket 60's decision and
   are **not** touched.
6. **Performance.** ~10,000 rows on disk: check `pnpm test` and `pnpm e2e` wall time before and
   after and record both in the ticket comments; if the contract test or the mutation run slows
   past 2×, note it under ADR-0009 rather than fix it here.

## Done when

- Generator asserts: per-human-workday root count within 1..9 for ≥ 95% of (Member, workday)
  pairs with any session; weekly spend within the band; window dates.
- `pnpm fixtures:generate` is byte-stable across two runs.
- With `AGENT_DASH_NOW` unpinned and today inside the window, every page renders and no row is
  dated after now (ticket 62's slice).
- All six gates green; e2e counts in `people.spec.ts`/`reading.spec.ts` updated to derived, not
  literal, values where they were literals.

## Notes

Runs after ticket 62, because from this ticket on the committed data extends past today.
Escalation rule applies (handover): pick the cheaper option, write it down, keep going.
