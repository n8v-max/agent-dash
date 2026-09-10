# Handover: AFK wave 3 (tickets 61–70)

Written 2026-09-10 from the human's review of the live site. `handover-afk-build.md` §§ 2, 5, 6
and `handover-afk-wave-2.md` § Rules still apply (environment, per-ticket loop, straight to
`main`, escalation = pick the cheaper option, write it under `## Comments`, continue). Read
`CONTEXT.md`, `docs/adr/`, the three specs, then this file.

## Waves

| Wave | Tickets | Parallel? |
|---|---|---|
| 1 | **61** switcher · **63** people controls + labels · **64** projection stack · **69** token units | Yes, file-disjoint |
| 2 | **62** data to now | No — touches clock, load, façade, e2e config |
| 3 | **65** names → **66** window + volume + curve → **67** work mix + reviews → **68** tokens + cost → **70** roster + palette | Serial, each regenerates the fixture |

Wave 3 is serial because every ticket rewrites `src/fixtures/data/**` and each one's invariants
must survive the next. Do not reorder: 62 must land before 66 or the committed data will run
past today with nothing cutting it.

## Decisions already taken (do not reopen)

- Contractor account: stop offering it, keep the Role and every test that mints it directly.
- Volume: one to nine root sessions per **human Member** per workday (~8,000 roots). The
  seat-cost finding is demoted in the spec, not preserved.
- Cost projection stacks on the **Projection page's** daily chart, same method.
- R-V7 is amended for the Model mix panel only: its own ten-colour palette, no Other.
- Landing (`/`) figures are hardcoded (ticket 60) and are not re-derived by any of these tickets.
- Readings of the human's words that the tickets rely on: People's "search selector" = the Sort
  menu; "kind … stasis" = Kind stays; "75K" = a token floor per session; "medians and billions" =
  millions and billions; deploy's ratio to implementation is unchanged.

## Gates

`lint` · `typecheck` · `test` · `test:coverage` · `build` · `e2e`, per ticket, before commit.
Record the six results and the fixture counts in each ticket's `## Comments`.
