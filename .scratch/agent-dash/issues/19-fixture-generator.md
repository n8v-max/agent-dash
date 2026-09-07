Type: implementation
Status: ready-for-agent
Blocked by: 17
Label: ready-for-agent

# Fixture generator and committed dataset

## Goal

A seeded, committed generator producing a committed JSON dataset that carries every property the
product's claims rest on.

## Scope

Implement `src/fixtures/generate.ts` and commit its output to `src/fixtures/data/`, satisfying
**R-D1 through R-D20** in full. Read them; they are the specification and are not restated here.

Shape the datasets by where they would really come from (R-T19):

| Dataset | Imitates | Shape |
|---|---|---|
| Sessions | Platform events | One file per `(repository × work_type)`, timestamp-ordered. **All 25 exist**; empty pairs hold `[]` |
| Members, Teams, Repositories, Tasks | Mocked GitHub API | GitHub field names, simplified envelope — no pagination, no `_links`, no unread fields |
| WorkTypes, Models, rate cards, Organization | Mocked internal API | Serialised as-is |

- **The generator holds both rate cards and prices every session, writing a `cost` field** (R-T22,
  ADR-0005). The application prices nothing. The token card is additionally serialised for display;
  the compute card is serialised for the generator's own use and rendered nowhere.
- **The generator asserts its own invariants as it writes** (R-T23) — span sums, every required
  distribution, every required edge case. A generator that silently omits the 90+ day bucket is
  worse than one that fails loudly.
- `src/fixtures/README.md` documents the authored GitHub → Member match rule (fuzzy on email and
  full name) so a reader can see the join. **No GitHub user fails to match** (R-D20).
- **The roster and token rate card are fixed by [ADR-0007](../../../docs/adr/0007-model-roster-spans-a-real-200x.md)** — do not use ticket 16's card.
  Ticket 16's check was run on 2026-09-07 and three of its seven model strings did not exist, while
  its "exactly 200×" was manufactured by errors at both ends. Seven models, three vendors, tiers
  2/2/3, real verified input prices, uniform 0.1× / 1.25× / 5× derivation, frontier over fast
  exactly 200×.
- **R-D16's spend share is derived, not hardcoded.** Assert the invariant — the `frontier` tier
  carries more token spend than any other tier while holding the smallest token share — and compute
  the percentage from the card. Ticket 16's "~56%" was against a card ADR-0007 replaced.

## Done when

All of **T-F1 through T-F8** pass, and **T-F9** (committed output matches the seed) runs green in
CI.

## Notes

Volume is deliberately low — ~750 sessions, an order of magnitude below the first proposal. That is
what makes seat cost (~48% of Total spend) the sharpest finding in the product. A high-volume
fixture would have buried it. Do not "improve" the fixture by adding sessions.

Tests read committed output and **never** run the generator (P3).
