Type: implementation
Status: ready-for-agent
Blocked by: 23
Label: ready-for-agent

# Efficacy metrics

## Goal

`src/domain/metrics/efficacy.ts` — Acceptance rate, Rework rate, Decomposition rate, Incomplete
Task buckets.

## Scope

- **Acceptance rate is computed within a WorkType only** (R-M6). Each WorkType defines its own
  criterion, so an Organization-level figure averages incommensurable criteria. The function must
  be **unable to produce** a cross-WorkType figure — not merely never asked to.
- **Rework**: a non-accepted session followed by another session on the same Task, **of any
  WorkType**. The same-WorkType clause was dropped in ticket 05 — a failed `review` followed by an
  `implementation` is still a second attempt at the same Task. Consequence accepted: the rate runs
  higher than the strict reading would give.
- **Decomposition**: a Task with more than one **accepted** session — work deliberately split, not
  work repeated.
- **Rework and Decomposition are independent labels, not a partition.** A long Task can exhibit
  both, and the fixture contains such a Task.
- **Incomplete Tasks**: Tasks with no accepted session, bucketed by **age since the last session** —
  0–7 · 8–30 · 31–90 · 90+ days (R-M16). "Now" is injected (P5).

## Done when

**T-U14, T-U15, T-U16** pass. All four age buckets are non-empty (R-D9).

## Notes

Incomplete is an umbrella **on purpose**. It covers work still in flight and work someone gave up
on, and the platform cannot tell them apart because it does not own the external Task's lifecycle.
Rather than invent a cutoff, report the count by age and let the reader conclude. Do not add a
status, a threshold, or an "abandoned" label.

The Task/AgentSession distinction exists so that Rework is *measurable at all* — three retries of
one Task and three first-time-successful Tasks are otherwise indistinguishable.
