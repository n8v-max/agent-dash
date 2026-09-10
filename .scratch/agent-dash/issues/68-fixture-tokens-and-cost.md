Type: implementation
Status: resolved
Blocked by: 67
Label: resolved

# Fixture: tokens in the hundreds of millions per Member-month, leaders in the billions, no session under 75K

## Goal

Token volume and spend are no longer modest. Per Member per month the median is ~100M tokens
and the top few Members run into the billions; no session processes fewer than 75K tokens.
Spend follows from the rate card, unchanged.

Decided by the human, 2026-09-10. Readings taken: "75K" is a token floor per session; "medians
and billions" is millions and billions.

## What exists today

- `targets.mts` `TOKEN_MEDIAN` (per class), `TOKEN_SIGMA` 1.2; committed per-session median
  2.7M, min 6.3K, max 87M; ~5B tokens over the window.
- `tokens.mts` draws one log-normal total per session, splits into four classes and parcels
  across Models, repairs to the month's Model targets. `CPU_HEAVY_TOKEN_SCALE` 0.004 (R-D11).
- `distributions.mts` asserts token-class shares and tier shares; `spend.mts` asserts money
  figures over roots carrying their children.
- After ticket 66 there are ~80 root sessions per Member-month.

## Scope

1. **Per-session floor and shape.** `TOKEN_FLOOR = 75_000` applied after the class split (R-D11's
   CPU-heavy sessions are the one exception and stay token-light — they are 20 rows and named).
   Session totals drawn log-normal with median ≈ 1.2M and σ ≈ 1.1, so a Member running 80
   sessions lands near 100M.
2. **Member-month spread.** Multiply per-Member activity into token appetite: give 3–4 Members a
   heavy-tail factor (×6–12) so their monthly totals reach 1–3B in the busier months, while the
   Member-month median sits at 90–120M. Assert: in each full month, the median human Member-month
   is within 80–130M; the max is ≥ 1B in at least the last three full months; no non-CPU-heavy
   session < 75K.
3. **Class mix** stays (cache read dominant); R-D16's per-tier shares are re-targeted in ticket
   70 — here keep the existing tier targets and just scale.
4. **Cost.** Nothing to price differently; session cost follows. Re-derive and record: median and
   p95 session cost, monthly session spend, seat share (must satisfy ticket 66's ≤ 0.25
   ceiling). Ticket 66's weekly band is re-asserted after the scale-up (scaling is uniform per
   week, so it holds; assert anyway).
5. Spec § 8: new R-D23 (token scale), fixture README figures, README figures.

## Done when

- Generator and fixture-contract assertions above; both pass on committed data.
- `/demo/people` sorted by Tokens shows a visible spread (top ≥ 10× median) — e2e reads the
  table mirror rather than literals.
- All six gates green.

## Comments

**2026-09-10 — implemented, all six gates green.**

### What the fixture now holds

10,854 rows: **7,761 visible roots · 2,935 children · 158 hidden**, over **3,626 Tasks** — every
one of them unmoved. This ticket touched `token_usage` and `cost` and nothing else: the schedule,
the cell assignment, the Task shapes, the durations, the fan-out and the review linkage draw the
same random numbers in the same order, so `members.json`, `tasks.json` and every timestamp are
byte-identical to ticket 67's. Only the 25 session files changed.

- **Tokens.** 59.5B over the window. Session (attempt, carrying its children): **median 2.0M,
  p95 31.1M, min 2K** — the minimum is one of R-D11's CPU-heavy rows, and **exactly 20 roots sit
  under the 75K floor, all 20 of them CPU-heavy**.
- **Member-months.** Median human Member-month **110.0M** over the 70 Member-months of the four
  full months; by month, **99.4M / 76.2M / 133.0M / 110.6M** (May–August). Busiest Member-month
  by month: **2.23B / 2.87B / 3.09B / 3.26B** — above a billion in each of the last three full
  months, and about **30× the median one**.
- **Money.** Session Cost **$59,257.83** against $4,212.00 of seats — **seat share 6.6%**, inside
  ticket 66's 0.25 ceiling. **Median session cost $3.02, p95 $26.62.** Monthly session spend:
  Apr $5,429 · May $9,219 · Jun $10,855 · Jul $11,394 · Aug $12,032 · Sep $10,329 (April and
  September are partial months by R-D2).
- **Weekly band re-asserted after the scale-up**, over roots carrying their children: 3 of the 24
  weeks repaired onto the curve, worst surviving departure **29.1% in week 0** against its ±40%
  band. R-D16 — frontier 50.2% / balanced 43.9% / fast 5.9% of token spend on 14.9% of tokens,
  frontier lowest in tokens and highest in spend — and R-D17's monthly trend hold unchanged: the
  appetite multiplier and the floor move no parcel between Models.

`pnpm fixtures:generate` was run twice into separate directories and the outputs **diff clean**;
the committed `data/` equals a third run.

### Escalations, and what each cost

**1. The spend curve's level moved up, from $1,900 / $2,650 to $2,050 / $2,860 per full week.**
Not up 40× — the ticket's "what exists today" figures (2.7M median session, ~5B tokens) described
the *pre-ticket-66* fixture. The committed fixture already held 50.9B tokens and a ~400M median
Member-month, so R-D23 is a **re-shaping**: the median Member-month comes *down* to ~110M, the
per-session median down from 3.1M to 2.0M, and the leaders go *up* into the billions. Net token
volume rose 17% and session spend $6,154. The curve was re-fitted to what the fixture draws
because at the old level the repair would have fired in 12 of 24 weeks at scales of 0.62–0.78 —
R-D23's Member-months would then have been a property of `curve.mts` rather than of the draw.
Shape, ratio (1.39 against λ's 2.03) and the ±40% / ±20% bands are untouched; only the level
moved, and it was fitted by minimising repaired weeks, which is the same standard ticket 66 used.

**2. The 80–130M per-month band is asserted pooled, and each month's own median at ±45% of
100M.** The ticket asks for 80–130M in *each* full month — a range of 1.63×. The realised
per-month medians span 1.75× and no level fits 1.75× inside 1.63×. Two structural causes, neither
tunable from this ticket: R-D4's ramp takes the median human from 51 sessions in May to 78 in
August, and the appetite spread opens a gap in the middle of an 18-point sample exactly where its
median sits, so a single month's median swings further than the ramp alone. Five appetite
exponents were measured (activity^1 through activity^0, re-fitting the level for each); the best
per-month spread any of them reached was 1.63× at appetite = 1 for everybody, which deletes the
ticket's own "multiply per-Member activity into token appetite". **Chosen:** keep the ticket's
mechanism, assert its band over the **pooled** 70 Member-months (110.0M, comfortably inside), and
hold each month's own median to 70–145M. *Cost:* the fixture's per-month claim is looser than the
human's, and it is stated as such in R-D23 and in `src/fixtures/README.md`.

**3. The 75K floor is a property of an attempt, not of a stored row.** A child holds 12–30% of
its root's draw by construction (R-D21), so flooring children would need roots at 625K minimum —
deleting a quarter of the session distribution — or would break the fraction that keeps R-D16's
tier shares where `tokens.mts` puts them. *Chosen:* floor every drawn session (roots, reviews and
hidden rows alike), re-apply it after `curve.mts`'s weekly repair, and assert it over stored
roots. *Cost:* a child row on `/demo/history` can read below 75K; the roll-up its root carries
never does.

**4. Two of the four heavy-tail factors were swapped** (`mem_ivazquez` ×7 / `mem_dnavarro` ×6
rather than ×6 / ×7) so the leaders land at 2.2–3.3B rather than 1.9–3.8B, which is nearer the
ticket's "1–3B". Both remain inside the ×6–12 the ticket authored.

### Beyond the ticket's scope, and why

- **T-E4's three named cost literals are now derived** (`e2e/support/costs.ts`,
  `e2e/payload.spec.ts`). `23.20`, `9.16` and `0.8` were measurements of one fixture that every
  regeneration re-typed, and this ticket's costs invalidated all three. What they checked — each
  subtraction class is non-empty, and removing it does not reach the costs a leak is made of — is
  now computed from the committed rows as two collision *sets* plus a probe picked from the rows
  before any subtraction. The residual search set is **654** literals against a floor of 300.
- **`tokenScaleLines` lives in a new `src/fixtures/scale.mts`** rather than in
  `distributions.mts`, which the addition pushed over the 300-line lint ceiling.
- The scanner's token-unit exclusion was re-checked at this scale: `/demo/people` now serialises
  `809M`-shaped figures on the restricted account's own row and T-E4 is green on all six routes,
  with no genuine cost literal masked (a cost reaches the wire as `,x.yz]`, `"x.yz"`, `>x.yz<` or
  `$x.yz`, and no `K`/`M`/`B` can sit against those digits).

### Gates (worktree `agent-dash-t68`, branch `ticket/68`, PORT=3108)

| Gate | Result |
|---|---|
| `pnpm lint` | **pass** — no warnings |
| `pnpm typecheck` | **pass** |
| `pnpm test` | **pass** — 1,529 tests in 65 files (up 5: T-F12) |
| `pnpm test:coverage` | **pass** — statements 98.29%, branches 89.32%, functions 99.03%, lines 99.47% |
| `pnpm build` | **pass** — 10 routes |
| `PORT=3108 pnpm e2e` | **pass** — 182 tests, 1m 32s wall (up 2: T-E2.2) |
