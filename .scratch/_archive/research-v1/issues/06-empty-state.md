Type: research
Status: ready-for-human
Priority: MEDIUM

# Design empty/zero-data state for new orgs

## Question

What does the dashboard show when an org has no sessions yet?

## Context

The dashboard is the product pitch. An unhandled empty state looks like a broken app to an interviewer who pokes around. Needs an explicit design decision before dashboard components are built.

## Options

- **A** — "Connect GitHub to get started" onboarding prompt with step list
- **B** — Skeleton charts with "no data yet" overlay on each panel
- **C** — Auto-seed a small fixture sample ("Your org's first week") as if the org just started
- **D** — Hybrid: onboarding prompt as hero + "Load sample data" shortcut that populates fixture data without requiring real setup

## Recommendation

D — gives the CEO/EM a realistic preview of what the dashboard looks like populated, while clearly signalling the onboarding path.

## Decision needed

Pick A/B/C/D or describe a preferred alternative. This decision gates the onboarding component in the build plan.

## Comments
