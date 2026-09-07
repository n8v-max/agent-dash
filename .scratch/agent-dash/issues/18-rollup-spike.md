Type: implementation
Status: ready-for-agent
Blocked by: 17
Label: ready-for-agent

# Roll-up spike — the falsification test for the charting decision

**Throwaway. Runs before any panel is built.** Ticket 14 names this "the cheapest available risk
reduction" and "the specific thing that would falsify this decision" (R-T31).

## Goal

Flip one shadcn/Recharts chart between 20 series and 4 series and watch the legend re-derive.
Establish, before the product depends on it, whether series identity survives a roll-up switch.

## Why it exists

Ticket 14 chose shadcn/Recharts 3 over Observable Plot on stack coherence and schedule, and
recorded honestly that **Plot's wins were traded away, not refuted**. Plot's one-accessor
re-grouping makes stale series structurally impossible — exactly the failure a roll-up switch
invites. This choice keeps that bug class, and this spike is the cost being paid down early.

The concrete hazard: shadcn's default legend uses `key={index}`, and ticket 14 deferred that patch
to encounter. With `key={index}` live, **React reconciles "Team A" into "Team B" in place** — the
DOM node persists, the colour persists, the label changes, nothing errors.

## Scope

- One chart, hard-coded data, a button flipping 20 → 4 series.
- Observe: does the legend entry set change identity, or only length? Do colours follow labels?
- Record what happens in this ticket's Answer, including whether patch 3 (`key={index}`) needs
  applying now rather than on encounter.
- Delete the spike. Its output is a finding and a decision, not code.

## Done when

The finding is written here, and either patch 3 is applied or the decision to defer it is
re-affirmed with the observed evidence behind it.

## Notes

Do not skip this because T-C3 will catch the bug later. T-C3 catches it in a component the product
depends on; this catches it while the charting decision is still cheap to reverse.
