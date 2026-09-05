Type: grilling
Status: open
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
