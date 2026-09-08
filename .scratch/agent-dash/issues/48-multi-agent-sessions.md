Type: implementation
Status: ready-for-agent
Blocked by: 40
Label: ready-for-agent

# Multi-agent: child sessions roll up to a root session

## Goal

The model has one agent per AgentSession. A sub-agent fan-out creates extra sessions on the same
Task, which the Rework and Decomposition rules count as retries. On a multi-agent platform the
differentiator metric is wrong.

## Scope

1. **Schema**: `parent_session_id: string | null` on AgentSession. A root has `null`. A child
   inherits Task, Member, Repository, WorkType and `execution_mode` from its root; the fixture
   validator rejects a child that disagrees.
2. **Glossary**: `CONTEXT.md` § Work gains **Root session** and **Child session**. Rework,
   Decomposition, Completed Task, Acceptance rate and Cost per session are defined over root
   sessions. A child never carries `accepted`; the root does.
3. **Domain**: `taskFacts` groups children into their root before deciding rework and
   decomposition. Session cost, tokens and duration of a child roll into the root for every
   aggregate. Session count means root count; a "Agents per session" reading is added to the
   Session duration panel (median, p95).
4. **Fixture generator**: ~20% of roots spawn one to four children, weighted toward
   `implementation` and `headless`. Children start after the root and end before it. Rework and
   Decomposition rates in `targets.mts` are unchanged and must still hit.
5. **History**: a root row expands to show its children indented, each with model mix and tokens.
   Hidden rule applies to children as to roots.
6. **ADR-0008** records the decision and the one it reverses in ticket 08 (one agent per session).

## Done when

- Unit: a Task with one root and three children, root accepted, is neither rework nor decomposition.
- Unit: cost of a root equals its own cost plus its children's.
- Invariant test: every child's parent exists, is a root, and shares the five inherited labels.
- Headline figures on `/demo` for Aug 2026 change only by the roll-up; Completed Jobs is unchanged.
- e2e: History expands a root to show child rows.

## Notes

Decided by the human, 2026-09-09, round 1: multi-agent is built; BYOK is an ADR only (ticket 57).
If the generator cannot hit the rework target with children present, lower the child share and
record the number in this file.
