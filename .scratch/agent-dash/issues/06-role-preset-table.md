Type: grilling
Status: wontfix
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

**Correction — ticket 12 was reversed after the note above was written (2026-09-05).** Read this
in place of it. Current position: [ADR-0003](../../../docs/adr/0003-individual-visibility-is-open-by-default.md).

- **Six scopes, not seven.** `cohort` is withdrawn from the subject-scope vocabulary and demoted to
  an aggregation dimension — a comparison group, gating nothing.
- **The default preset grants `org-member` over `jobs`, `tokens` and `cost`.** Named individual
  usage and spend, org-wide, to every Member, symmetrically. There is no asymmetric grant; no tier
  sees more than an ordinary Member.
- **The model-mix contingency is void.** Named currency is shown directly, so reconstructing it
  from volume × rate card protects nothing.

**This ticket's real work is now the restricted presets, not the permissive one.** Because the
default grants every cell, the matrix demonstrates nothing on its own — and `CONTEXT.md` still
calls it a central, non-obvious idea. So the presets that earn their place are the ones that
*restrict*: what they are, why each exists, and which cells each withholds. Candidates worth
arguing rather than assuming — a contractor limited to `self`; a finance role holding `cost` but
not `jobs`; a lead scoped to `team`. At least one must be legible in ten seconds on `/demo`
(ticket 03's measured budget), because the role switcher is the only place the mechanism is
visible at all.

Still open and still yours: whether `org-member` × `access` survives, and whether a Member holds
one preset or several.

**From ticket 05 (2026-09-07, HITL)** — the self view is settled in shape and shared with this
ticket: **the same metric set at `self` scope, plus the cohort comparator**, which answers *"am I
heavy or light on work like mine"* — a question that only has meaning from a personal vantage.
No second metric set. That closes brief 15's G9.

The datapoint-class assignment for every metric is now filled in 05's inventory table, which is
what the restricted presets actually withhold. A preset granting `jobs` but not `cost` hides
Total spend, cost per session and cost per completed Task — including **the third headline
tile**, which is the product's differentiator. Whether a restricted preset that removes the
differentiator is worth shipping on `/demo` is a real question for this ticket.

## Closed 2026-09-07 — wontfix

Scope cut to the top three tickets. This one is **not answered; it is defaulted.**

**The default that now applies.** One preset ships: the permissive one ADR-0003 already
specifies — every Member holds `org-member` scope over `jobs`, `tokens` and `cost`. The
permission matrix is rendered read-only as documentation of the model, and nothing restricts.

**What that costs.** `CONTEXT.md` calls the two-dimensional matrix a central, non-obvious idea,
and with no restricted preset it demonstrates nothing: a grid where every cell is granted is
indistinguishable from having no grid. The mechanism is described but never exercised, in the
demo or in tests. If one thing is later reinstated from this ticket, it should be a **single**
restricted preset — a contractor scoped to `self` is the cheapest — purely so the switcher on
`/demo` has two states to switch between.

Also unanswered and now defaulted: `org-member` × `access` survives by default, and a Member
holds exactly one preset.
