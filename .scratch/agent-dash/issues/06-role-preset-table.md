Type: grilling
Status: open
Label: wayfinder:grilling

# The role preset table

## Question

Which role presets ship, and exactly which cells of the (subject scope × datapoint class)
matrix does each grant?

## What has to come out of it

- The named presets, and why each exists as a distinct one rather than collapsing into another.
- A filled grid per preset across all six subject scopes and all four datapoint classes.
- Whether a Member holds exactly one preset or several, and what happens when scopes overlap —
  a lead who is also an individual contributor, or a Member on two Teams.
- Whether any cell combination is incoherent and should be unrepresentable rather than merely
  ungranted.
- How the presets are expressed as fixture data.

## Inputs handed over by resolved tickets

**From ticket 03 (2026-09-05)** — the evidence behind the vantage points is uneven, and the
preset table should reflect that rather than treating all cells as equally justified:

- `self` is the best-evidenced grant (Meyer et al., CSCW 2018: 84.5% awareness gain). Peer
  comparison is simultaneously what makes it valuable and what must stay de-identified.
- `org` + `cost` has the clearest statement in the literature.
- `team` / `peer` is moderately evidenced.
- `org-member` + `access` is the **weakest**, resting only on NIST AC-6(7) and convention. If a
  preset grants it, that grant needs its own justification.
- **Microsoft Viva ships two separate floors**, distinguishing *who gets a view* from *which
  cells are suppressed*. That separation may belong in this model — see ticket 12.

## Constraints already settled

The matrix shape and its vocabulary are fixed in `CONTEXT.md` § Access. Peer scope grants
`jobs` and never `cost` (`docs/adr/0001`). Role authoring UI is out of scope, but the
permission model is rendered read-only, so the grid is a user-facing artifact and has to read
clearly to someone seeing it for the first time.
