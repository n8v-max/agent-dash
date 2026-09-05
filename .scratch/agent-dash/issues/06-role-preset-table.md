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

**From ticket 12 (2026-09-05, HITL)** — this ticket's grid changed shape before it was filled:

- **Seven scopes now, not six.** `cohort` is added — named Members doing comparable work, across
  Team boundaries, keyed on a **viewer-selected** dimension (work domain / template / both). It is
  computed per view, not stored, so the preset grid grants *access to the cohort scope*, not
  membership of a particular cohort. `peer-team` is retained but loses its "never resolved to
  named Members" clause.
- **The presets are mostly not what varies.** The default is now near-universal and symmetric:
  every Member gets `peer` × `jobs`, `cohort` × `tokens`, `self` + `team` per-capita × `cost`.
  **Exactly one asymmetric grant exists** — named individual `cost` breakdown at team-level
  access. That is a much thinner preset table than this ticket assumed, and the question shifts
  from "what does each preset grant" to "does the matrix still earn its keep with one varying
  cell". Answer that explicitly; it is the kind of thing an interviewer probes.
- **No floor, anywhere.** Population size grants nothing and withholds nothing, so no preset needs
  a threshold parameter.
- **`org-member` × `access` is now weaker still.** Ticket 03 already flagged it as the
  least-evidenced grant; with role authoring out of scope and only one asymmetric cell to
  administer, ask whether it survives at all.

**Owned by this ticket and load-bearing: is per-named-Member model mix exposed?** `CONTEXT.md`
defines `tokens` as "TokenUsage volume **and Model mix**". Named volume + named model mix + the
visible rate card reconstructs named currency by multiplication — which circumvents the `cost`
position ADR-0001's amendment preserved. Model was settled as a *distribution display, not a
filter*, which points the right way without closing it. **ADR-0002's `cost` clause is contingent
on this answer**, so it cannot be left implicit.
