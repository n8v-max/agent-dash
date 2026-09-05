Type: grilling
Status: resolved
Label: wayfinder:grilling

# Aggregate re-identification below a population floor

## Question

Does aggregated visibility require a minimum population, and what does the product show when a
population is too small to aggregate safely?

## Why this exists

Graduated from ticket 01 on 2026-09-05.

The access model rests on a distinction between seeing a population's *totals* and resolving
those totals to *named people* (`CONTEXT.md` § Access), and ADR-0001 relies on that distinction
to withhold peer-level cost. **Arithmetic defeats it in small populations.** On a Team of two,
`team` aggregate cost minus `self` cost is the other member's cost exactly. On a Team of three
it is a tight bound. The guarantee ADR-0001 appears to make does not hold at the sizes real
teams actually have.

GitHub Copilot is the only surveyed product that addresses this, with a hard floor of five
licensed members per day, enforced at the API rather than in the UI.

## Inputs handed over by resolved tickets

**From ticket 03 (2026-09-05)**, confirming and extending 01:

- **Only GitHub has a privacy floor** among surveyed AI-coding products (teams &lt;5 excluded).
  Cursor, Claude Code and Amazon Q expose named users with no floor at all.
- **Microsoft Viva ships two floors**, separating *who gets a view* from *which cells are
  suppressed*. That is a stronger model than a single threshold and may be the right shape here.
- Google's stated practice — *"no data ever leaves our team un-aggregated"* — is the clearest
  articulation of the boundary this ticket defends.
- Counterweight: **over-aggregation is a documented failure mode**. A floor set too high
  collapses the product into org totals, which the DevEx literature names as its own mistake.
  This ticket is bounded on both sides.

## What has to come out of it

- Whether a minimum-population floor exists at all, and if so what the number is and what it is
  derived from rather than guessed at.
- Which datapoint classes it applies to. `cost` is the obvious one; whether `tokens` leaks the
  same information through rate cards is a real question, since cost is derived from tokens.
- What is shown below the floor: suppression, a merged bucket, noise, or nothing at all — and
  what each does to the product's credibility.
- Whether the floor applies to `peer-team` aggregates too, where the same subtraction works
  across Teams.
- Whether `self` is excluded from the aggregate the acting Member sees, which changes the
  arithmetic.
- Whether this is enforced in the data layer or in the view — a UI-only floor is not a floor.

## Feeds

06 (the preset table has to encode whatever this decides), 10 (fixture team sizes must be able
to exercise both sides of the floor), and ADR-0001, whose stated guarantee is currently
weaker than it reads.

## Answer

Resolved by the human, 2026-09-05, through six rounds of grilling. **The ticket's own question is
answered "no" — but the process reopened the premise it rested on, and the substantive outcome is
a change to the access model rather than a threshold.**

### The direct answer

**No minimum-population floor exists, at any scope or for any datapoint class.**

Nothing is suppressed, merged, noised or hidden below any population size. GitHub Copilot's k=5
precedent is noted and not followed.

### Why the question dissolved rather than being answered

The ticket assumed the thing being protected was *resolution of an aggregate to a named person*.
Grilling the purpose of the aggregate broke that assumption. The stated reason a Member sees any
comparison figure is **ballpark self-reference** — "am I heavy or light" — **not** auditing
company expense. Once that is the job, two things follow that a floor cannot deliver:

1. **The Team is the wrong comparison population.** It is an organisational unit; the question is
   an analytical one. Comparing the one mobile specialist against four backend engineers answers
   nothing, floor or no floor. As the human put it: *"if there's only 1 person in the team does
   the same work, the visibility matters."*
2. **A floor destroys the job it was protecting.** Suppressing the comparison for a small
   population removes the reference value entirely, which is the over-aggregation failure mode
   ticket 03 documented on the other side of the argument.

So the design moved from *"how large must a population be"* to *"which population, per class"*.

### What replaced it: the unit of comparison differs by datapoint class

| Class | Unit | Default for a Member | Additional grant |
|---|---|---|---|
| `jobs` | `peer` | named teammates | — |
| `tokens` | `cohort` | named, anyone doing comparable work, any Team | — |
| `cost` | `team` | own spend, plus Team **per-capita** — not named | team-level access → named individual breakdown |

Recorded in `CONTEXT.md` § Access and
[ADR-0002](../../../docs/adr/0002-comparison-unit-differs-by-class.md).

- **`cohort` is a new, seventh subject scope**, keyed on a **viewer-selected** dimension —
  Repository work domain, AgentTemplate, or both. Membership is computed per view, not stored; a
  Member belongs to as many cohorts as they do kinds of work.
- **The six existing scopes are all retained.** `peer-team` loses its *"never resolved to named
  Members"* clause, since named cross-Team reach now exists via `cohort` for `tokens`.
- **Self is included** in Team aggregates, with the self/others split shown rather than hidden.
- **Filters are Repository and AgentTemplate. Model is a distribution display, not a filter.**
- **Every Member, symmetrically** — token visibility is not preset-gated. Named currency is the
  one asymmetric grant, held with team-level access.
- **Enforced in the data layer**, not the view: a below-grant figure never reaches the client
  payload. This makes permission filtering a pure function over fixture rows — directly relevant
  to ticket 09, which needs the permission matrix asserted combinatorially rather than by clicking.

### What was deliberately accepted

**The subtraction hole, unguarded.** Team per-capita × headcount is the Team total; minus one's
own spend it resolves to the remaining members' total — *exactly*, on a Team of two. This is the
precise attack the ticket was opened to close, and the decision is to accept and disclose it. The
product's claim is now that it does not **display** named peer currency, not that named peer
currency is **unrecoverable**. The weaker claim is the true one.

**No structural guardrail against ranking.** Offered and declined. The access model neither
mandates nor forbids a leaderboard; whether a top-spenders view ships is left to tickets 05 and
07. This is recorded as *declining to prohibit*, not as endorsing.

The Goodhart exposure this leaves is real and was raised explicitly before the decision. Every
documented 2026 failure was a ranking: Meta's Claudeonomics ranked the top 250 token users with
gamified tiers and lasted two days; Amazon's KiroRank induced *tokenmaxxing* — agents pointed at
pointless work to climb — which **raised compute spend with no matching value**; Microsoft
pre-empted the same by budgeting at division level. The mitigations actually in place are
symmetry (no asymmetric watcher) and the fact that the cross-person figure is *volume*, which the
~200× tier spread makes a weak target to inflate toward. Both are weaker than a structural rule.

### Answers to the ticket's original sub-questions

- **Does a floor exist, what number, derived how?** No floor. No number.
- **Which datapoint classes would it apply to?** Moot. Note the finding that motivated the
  question: `cost` is derived from `tokens` against a rate card the map already decided ships
  visible, so a floor on `cost` exempting `tokens` would have had a door in it.
- **What is shown below the floor?** N/A. Nothing is ever suppressed for population size.
- **Does it apply to `peer-team`?** N/A. `peer-team` remains aggregate-only by scope definition,
  not by threshold.
- **Is `self` excluded from the aggregate?** No — included, and the self/others split is shown.
  Excluding self would have been strictly worse: on a Team of two it hands over the colleague's
  exact figure with no arithmetic at all.
- **Data layer or view?** Data layer.

### Open consequences handed forward

- **→ 06.** `tokens` is defined in `CONTEXT.md` as "TokenUsage volume **and Model mix**". Named
  volume + named model mix + a visible rate card reconstructs named currency by multiplication,
  circumventing the `cost` position this ticket preserved. Model was settled as a *distribution
  display, not a filter*, which points the right way but does not close it. **Whether
  per-named-Member model mix is exposed is not decided**, and ADR-0002's `cost` clause is
  contingent on the answer. The preset grid must also encode the new seven-scope vocabulary and
  the one asymmetric grant.
- **→ 05.** Token volume is now the most widely visible cross-person metric, but the ~200× tier
  spread makes it a poor predictor of spend. It therefore serves **adoption intensity**, not cost
  control — and cost control is the product spine. That gap is this decision's largest unresolved
  cost. 05 also inherits the ranking question the access model declined to settle.
- **→ 07.** Two comparison surfaces now exist, not one: cohort-keyed token comparison and
  team-keyed currency. The cohort key is a user-facing control (domain / template / both).
- **→ 10.** No floor means fixture Team sizes are unconstrained by this ticket — the "must
  exercise both sides of the floor" requirement is withdrawn. Replaced by a new one: the fixture
  must contain **at least one Member whose cohort crosses a Team boundary**, or the cohort scope
  is never exercised.
- **→ ADR-0001** amended: `tokens` clause reversed, `cost` clause stands, both Known gap and Known
  hole marked resolved. **ADR-0002** added.
