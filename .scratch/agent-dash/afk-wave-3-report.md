# AFK wave 3 — what happened

Written 2026-09-10 by the session that ran it. Companion to `handover-afk-wave-3.md`, which set it
up. **Every ticket 61–71 is `resolved`, every merge was green on all six gates, and `main` is
pushed at `1a41e62`.**

| Gate on `main` at the end | Result |
|---|---|
| `pnpm lint` | clean |
| `pnpm typecheck` | clean |
| `pnpm test` | **1,542** tests, 65 files |
| `pnpm test:coverage` | statements 98.30 · branches 89.45 · functions 99.03 · lines 99.47 |
| `pnpm build` | 10 routes, Turbopack; `/sign-in` still `○ (Static)` |
| `pnpm e2e` | **187** passed, both Playwright projects, ~1m 36s |

`pnpm fixtures:generate` on `main` produces no diff: the committed data is what the generator
writes.

## Nothing is red

No ticket was stopped. No rule was disabled, no test skipped, no `eslint-disable`,
`@ts-expect-error` or `as any` added. Every ticket ran its own six gates in its own worktree
before commit, and `main` ran all six again after every merge — eleven full gate runs.

## Wave order, as merged

| Wave | Tickets | Notes |
|---|---|---|
| 1 | 63, 69, 64, 61 | fanned out, four worktrees, ports 3101/3103/3104/3109; merged one at a time |
| 2 | 62 | alone — clock, load, façade, e2e config |
| 3 | 65 → 66 → 67 → 68 → 70 | serial, each regenerating the fixture |
| 4 | 71 | filed mid-run by another session; file-disjoint, taken last |

The handover's parallel assumption for wave 1 held: no conflict between the four branches beyond
`Status:` lines and adjacent spec paragraphs, all auto-merged.

## Where the fixture ended up

| Measure | Before | After |
|---|---|---|
| Window | 12 Apr – 8 Sep 2026, 150 days | 12 Apr – 25 Sep 2026, 167 days |
| Rows on disk | 1,049 | 10,854 |
| Visible roots | 742 | 7,761 |
| Tasks | 570 | 3,626 |
| Tokens | ~5B | 61.5B |
| Session cost | $4,905.39 | $72,682.16 |
| Seat share of Total spend | 46.2% | 5.5% |
| Models | 7 | 10, in 8 families |
| Vendor token split | — | Anthropic 58.0 · OpenAI 31.9 · Google 10.1 |

## Decisions taken under the escalation rule

Each is written up in its own ticket's `## Comments`. These four are the ones a reader should know
about without opening a ticket.

1. **Deploy's ratio to implementation did not survive (ticket 67).** The handover listed it as
   unchanged. R-D6 and R-D7 are two marginals of one table, and a review population at 39% of
   sessions accepting at 0.86 forces the WorkType marginal to ~0.75 against a Repository marginal
   of 0.663 that cannot move (0.78 is the highest rate on the list). Widening
   `SHARE_TRANSFER_LIMIT` does not close it — it takes share out of `review` and deletes the
   ticket. Deploy, the one WorkType the ticket itself flags as an assumption rather than a human
   decision, absorbs the residual and rises to ~1.3 per implementation. No authored acceptance
   rate moved and the human's three ratios are exact. Realised: review 39.3 · deploy 28.6 ·
   implementation 22.0 · bugfix 6.4 · refactor 3.8. **The alternative is re-authoring R-D7's five
   repository rates upward, which is a human call.**
2. **The weekly spend curve's level is authored, not inherited (tickets 66 and 68).** The
   ticket's ~$450/week is unreachable: machine allocation alone is ~$1.95 per attempt, so an
   April week costs ~$460 before a token is drawn. Shape, ratio and both tolerance bands are the
   ticket's; only the level moved, and ticket 70 re-fitted it again when the roster changed the
   price mix. 3 of 24 weeks repaired.
3. **OpenAI publishes `gpt-5.2`, not `gpt-5-2` (ticket 70).** Verified against the first-party
   pricing and models pages on 2026-09-10 at $1.75/MTok input. Third-party aggregators quote
   $0.875 and call it a recent cut; the first-party page wins, as ADR-0007 did, and the
   discrepancy is recorded in ADR-0011 rather than averaged. Structurally inert — `balanced` at
   either figure.
4. **Ten colours cannot pass an all-pairs contrast gate (ticket 70).** The Model mix palette
   passes the adjacent-pair test with margin (worst CVD ΔE 11.3 light / 10.2 dark against a
   target of 8) and fails all-pairs. That is the documented series cap of the method, not a
   defect in the values; a constrained optimiser under the vendor-hue requirement did no better.
   Relief shipped instead: a labelled legend, the levels table with every Model's exact share,
   and the R-X1 mirror.

## Latent defects found and fixed on the way

- **Two generator bugs unreachable at the old volume (ticket 66).** Session slots were keyed by
  `started_at_ms`, which collides at nine sessions a day, and the round-robin over-subscribed
  R-D10's near-idle seat holder. Both now structural.
- **The as-of stamp named a session that had not happened (ticket 62).** Seven of the 742
  committed roots ended after the clamped clock, including the one the stamp read. The slice
  fixes it; the ticket's "no-op until 66" note is therefore approximately, not exactly, true.
- **Task titles repeated ~40× each (tickets 66 → 67).** 2,959 distinct titles over 3,626 Tasks
  now, worst repeat 7.
- **`docs/security.md` claimed both seeded accounts are offered (ticket 71).** False since
  ticket 61; three words changed, argument untouched.

## Left for the human

- **The deploy ratio, above.** The only decision this run overturned rather than filled in.
- **Mixed spelling.** Ticket 63 set the Per control's options to "Organisation" as directed, while
  chart titles and `CONTEXT.md` keep "Organization". Both now appear on `/demo/spend`. Worth one
  small ticket either way.
- **Two named trade-offs in ticket 70**, each needing a spec amendment it does not carry: chart
  colour follows series rank rather than being pinned to a Model, and the Model mix's pinned
  0–100% axis leaves the lines in the bottom third because no Model exceeds ~30% at exact level.
- **The contract test slowed 2.3×** at the new volume, past ticket 66's threshold. Recorded under
  ADR-0009 § Consequences rather than fixed, as that ticket directed.
- **`pnpm test:mutation` was not run** — it is not one of the six gates and costs hours at this
  volume. Its cost tracks `pnpm test`, which grew 1.26×.
- **Ticket 70's header still reads `Blocked by: 68, 71`** though it landed before 71. The two are
  file-disjoint, so the ordering intent was moot; left as filed rather than rewritten after the
  fact.
