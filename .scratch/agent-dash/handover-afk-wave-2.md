# Handover: AFK wave 2 (tickets 39–57)

Written 2026-09-09 from a live-site UX review, three rounds of human decisions, and the spec-gap
list. Supersedes nothing; `handover-afk-build.md` §§ 2, 5, 6 still apply (environment, worktrees,
per-ticket loop). Read `CONTEXT.md`, `docs/adr/`, the three specs, then this file.

## Rules for this wave

- **Commits go straight to `main`.** Human decision. No PR flow.
- **Escalation**: on a decision you cannot resolve, pick the cheaper option, write the choice and
  its cost under `## Comments` in the ticket, and continue. Do not stop.
- **Stop condition**: none. Work every ticket in wave order until interrupted. Each ticket commits
  green on its own with all six gates.
- **Do not touch `src/app/page.tsx`.** Ticket 37 (landing) is the human's and is in the working
  tree uncommitted.
- Spec edits are part of the ticket: when a ticket changes R-N4, C13 or similar, amend
  `spec.md` and `testing-spec.md` in the same commit.
- Push `main` after each wave so Vercel deploys. The live site was three commits behind at
  review time.

## Waves

| Wave | Tickets | Parallel? |
|---|---|---|
| 1 | **39** summary · **40** null denominators · **41** formatting · **42** projection · **47** sign-in | Yes, file-disjoint |
| 2 | **43** controls and nav | No, toolbar |
| 3 | **44** member bars + repo grain · **45** lines, prose, as-of | Serial |
| 4 | **46** mobile | No |
| 5 | **48** multi-agent | No, schema |
| 6 | **51** property tests · **53** fixture contract · **50** roadmap · **57** BYOK ADR | Yes |
| 7 | **52** mutation · **54** scale ADR · **55** ingest · **56** security | Yes |
| 8 | **49** README | Last |

## Decisions already taken (do not reopen)

Fourth tile keeps the template breakdown. Summary keeps a month picker, drops "All data". Delta
hidden on a partial current month. Global bar keeps five groups, toggles go panel-local. Full phone
support. Member subject renders ranked bars. Cost by Repository reads months. Null for every zero
denominator. Seat cost visible to the restricted account stays (accepted leak). Multi-agent is
built; BYOK is an ADR. Landing copy is the human's.
