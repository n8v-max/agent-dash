Type: implementation
Status: resolved
Blocked by: 17
Label: resolved

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

## Comments

### 2026-09-07 — implemented (AFK build, wave 1)

Gates green: `lint` · `typecheck` · `test` (31 tests) · `build`. `pnpm fixtures:generate --out <tmp>`
run twice is byte-identical, and `diff -r src/fixtures/data <tmp>` is empty — T-F9 verified locally
and wired into `.github/workflows/ci.yml` between Typecheck and Unit tests.

23 seeded `.mts` modules (`SEED = 20260412`, mulberry32) under `src/fixtures/`, all inside the
300-line budget, plus 33 committed JSON files. **No new dependency**: `.mts` runs directly on the
Node 24 the project already pins, so nothing was added to run the generator. `tsconfig.json` gains
`allowImportingTsExtensions: true`, which is what lets the `.mts` modules import each other with
the explicit extension Node requires while `tsc --noEmit` stays happy.

`src/**/*.{ts,tsx}` was widened to `{ts,tsx,mts}` on the `quality-budgets` and `naming` eslint
blocks. Without it the generator — the largest body of code in the repo at this point — would have
been exempt from every budget the project sets. It caught two naming violations immediately.

`src/fixtures/data/.gitkeep` is deleted deliberately: the generator clears its output directory, so
a committed file it does not write would fail the T-F9 `diff -r` forever.

Independently verified against the committed JSON, not just self-reported: **757 sessions** across
25 files, `mobile-app__deploy.json` the only `[]`; **15 hidden rows (2.0%)** present and *not*
filtered — the exclusion is `src/data/load.ts`'s job (ticket 20) and these are what make it
testable; **zero span-sum violations**; every row carries a numeric `cost`; every `task_key` matches
`owner/repo#number`.

Generator self-report (R-T23, thrown on violation): acceptance within 0.007 of every R-D6/R-D7
target · rework 0.181 · decomposition 0.121 · incomplete-task buckets 13/33/66/**34** so 91+ is
non-empty · 20 CPU-heavy token-light · 39.8% multi-model · monthly frontier share
0.250 → 0.100 · **session cost $4,523.63 against seat cost $4,212.00 = 48.2% of Total spend**,
which is R-D4's "~$4,500 … ~48%" reproduced rather than transcribed.

**R-D16 is derived, never hardcoded.** From ADR-0007's card and the tokens actually emitted:
frontier carries **49.9% of token spend on 14.6% of tokens** (balanced 44.5%, fast 5.6%). The
asserted invariant is ADR-0007's own wording — frontier spend exceeds every other tier while its
token share is the smallest — checked pairwise against the other tiers, not against a number.
Ticket 16's "~56%" appears nowhere. Card verified: 10.00 / 0.05 = exactly 200×.

The invariant tests restate the spec's target figures locally rather than importing the generator's
`targets.mts`, so editing a target cannot silently move the test with it.

### Finding 1 — R-D5's stated consequence is false, and A7 does not discriminate

**R-D5 says sessions "between 22:00 and 24:00 Europe/Madrid … land on the previous UTC day". They
do not.** The fixture window (12 Apr – 8 Sep 2026) is entirely CEST, UTC+2. 23:30 Madrid is 21:30
UTC **on the same date**. Local is *ahead* of UTC, so the rows whose UTC date actually differs are
the ones just after local midnight: 00:30 Madrid is 22:30 UTC on the **previous** day.

This matters beyond the fixture, because A7 and T-U1 inherit the error. **A7 — "a session at 23:30
Europe/Madrid buckets to that local day, not the previous UTC day" — cannot fail.** Bucketing that
row by UTC yields the same day as bucketing it locally, so a naive UTC implementation passes the
suite's sharpest timezone case. The discriminating row is the 00:30 local one, which no requirement
currently names.

**Handled without editing any spec, and without pre-empting the decision.** The generator seeds
both populations: **55 rows in the literal 22:00–24:00 window** R-D5 and T-F6 name, and **29 rows
whose UTC date genuinely differs from their Madrid date** (all 00:00–02:00 local). T-F6 asserts the
literal requirement, and separately asserts the property the requirement was reaching for. So the
fixture satisfies R-D5 as written *and* gives T-U1 something that can actually fail. Ticket 22 has
been pointed at this.

Verified rather than assumed: no DST transition falls in the window — the generator checks via
`Intl` that Madrid's offset is +02:00 on every row it writes.

### Finding 2 — ticket 10's session-cost figures are not jointly reachable

Ticket 10's median ~$3.20 with p95 ~$35 implies σ≈1.46 on a lognormal, a mean near $9, and roughly
$6,900 of session spend — which contradicts R-D4's ~$4,500 and its ~48% seat share. **R-D4 is in
the spec and ticket 10's p95 is not**, so R-D4 wins. Committed data: median **$3.44**, p95
**$18.42**, total **$4,523.63**. The p95 is the figure not hit; recorded rather than reconciled.

### Note — R-D6 and R-D7 are two marginals of one table

They cannot both hold unless they agree on the grand total. `allocation.mts` solves the table by
transferring session share between `review` and `deploy` (the two ends of R-D6) and asserts the
transfer stays under 0.01; the solved value is **0.002**, so the authored mix survives essentially
intact. This is what fixes the authored `review`/`deploy` volume shares at 0.12/0.20. Not a
conflict, but it is a constraint neither requirement states, and a future edit to either
distribution has to respect it.
