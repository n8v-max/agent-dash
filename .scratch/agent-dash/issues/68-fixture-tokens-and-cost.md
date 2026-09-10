Type: implementation
Status: ready-for-agent
Blocked by: 67
Label: ready-for-agent

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
