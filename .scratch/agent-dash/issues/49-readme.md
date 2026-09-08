Type: implementation
Status: ready-for-agent
Blocked by: 39, 40, 41, 42, 43, 44, 45, 46, 47, 48
Label: ready-for-agent

# README

## Scope

In this order, under 200 lines:

1. The positioning block: one line, the claim, who it is for, what we refuse to claim, three
   levers, the open-visibility default, what it is not. Source: the human's positioning of
   2026-09-09 (copy is in `docs/positioning.md`, write that file first from this ticket's Notes).
2. Live URL, the two demo accounts, and the thirty-second path: sign in as open, read the four
   tiles, switch to restricted, watch People shrink.
3. One screenshot of `/demo` at 1440, committed under `docs/img/`.
4. How it is built: stack, the computation/rendering seam, the fixture generator, the gates.
5. How to run: install, dev, test, coverage, e2e, generate fixtures.
6. Test posture: coverage gate, property tests, mutation score (from ticket 52), fixture contract.
7. Links: `CONTEXT.md`, `docs/adr/`, `docs/roadmap.md`, the specs.

## Notes

Positioning text to place in `docs/positioning.md`:

One line: Agent spend, priced per finished task. Not per token, not per seat.
Claim: every agent platform tells you what you spent; none tells you what you got for it. This
dashboard joins the two. Cost per completed task, with failed attempts in the numerator.
Audience: the engineering leader who signs the agent bill and cannot explain it.
Refused claim: no productivity gain, no pre-agent baseline exists.
Levers: model mix (200× price spread by tier), rework (a task that needed three attempts cost
three times its price), seats (a seat held against near-zero usage is the most expensive unit of
work in the org).
Default: individual spend is open to everyone in the org, symmetric, sorting but no leaderboard.
Not: a billing page, a trace viewer, a performance review tool.
