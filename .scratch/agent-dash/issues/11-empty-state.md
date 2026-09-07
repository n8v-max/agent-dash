Type: prototype
Status: wontfix
Blocked by: —
Label: wayfinder:prototype

# Zero-data state

## Question

What does this dashboard show an organisation that has no data yet?

## Why this is a prototype and not a conversation

"How should it look and feel when there is nothing to show" is not settleable by talking. Build
something rough and concrete to react to, and link it from this ticket as an asset.

## What has to come out of it

- Whether the zero state is one page-level treatment or a per-surface one.
- What it communicates: what the product will do, what the viewer must do next, or both.
- How it differs between someone who can act on it and someone who cannot — a viewer with no
  `access` permission cannot connect anything.
- Whether the shell, navigation and controls stay present or collapse.
- Whether there is a path from zero state into populated data without real setup, and what that
  does to the credibility of the demo.

## Constraint

Whoever resolves this must not pick the variation themselves. Build the options; the selection
is the human's.

## Inputs handed over by resolved tickets

**From ticket 03 (2026-09-05)**: NNG explicitly endorses *"explore with demo data"* as a
first-run affordance, which is direct support for a populate-without-setup path — but vendor
self-reported data shows demos in the data/cloud sector have the **worst completion of nine
sectors** when long (43 steps → 10.7% completion; 9 steps → 64%). Whatever this prototype
proposes, length is the variable that kills it.

## Blocked by

05 and 07 — the panels and surfaces have to exist before their empty form can be designed.

## Closed 2026-09-07 — wontfix

Scope cut to the top three tickets.

**The default that now applies.** No designed zero-data state. The demo always carries data, and
surfaces fall back to plain "no data for this selection" text where a filter empties a panel.
The shell, navigation and controls stay present in that case.

**What that costs.** The first-run experience is undesigned. NNG's *"explore with demo data"*
affordance is not taken, and an organisation with no data would see a functioning dashboard full
of empty panels. Acceptable here because `/demo` is the only surface a reviewer will reach, and
it is never empty.
