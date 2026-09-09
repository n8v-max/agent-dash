# Positioning

The human's positioning of 2026-09-09, recorded verbatim in
[ticket 49](../.scratch/agent-dash/issues/49-readme.md) and copied here unedited. `README.md` § 1
is this page compressed; where the two differ, this one is the source.

**One line:** Agent spend, priced per finished task. Not per token, not per seat.

**Claim:** every agent platform tells you what you spent; none tells you what you got for it. This
dashboard joins the two. Cost per completed task, with failed attempts in the numerator.

**Audience:** the engineering leader who signs the agent bill and cannot explain it.

**Refused claim:** no productivity gain, no pre-agent baseline exists.

**Levers:** model mix (200× price spread by tier), rework (a task that needed three attempts cost
three times its price), seats (a seat held against near-zero usage is the most expensive unit of
work in the org).

**Default:** individual spend is open to everyone in the org, symmetric, sorting but no
leaderboard.

**Not:** a billing page, a trace viewer, a performance review tool.

---

## Where each line is held to

Not part of the positioning — this is the map from it to the artefact, so that a claim above is
checkable against something other than itself.

| Line | Held to by |
|---|---|
| One line | `src/app/page.tsx`, the landing's `<h1>`. It reads *measured* rather than *priced*: a vendor's verb on a hero reads as how this product charges you. |
| Claim | **Cost per completed Job**, the fourth tile on `/demo` and the ratio `/demo/spend` opens with (`CONTEXT.md` § Metric Concepts; `spec.md` R-M1, *"the join"*). |
| Refused claim | `e2e/smoke.spec.ts` — the landing is asserted against `/faster\|productiv\|velocity\|10x/i`. `spec.md` § 1 carries the argument. |
| Model mix | ADR-0007. The 200× is a property of this project's roster and is stated as one. |
| Rework | `CONTEXT.md` § Rework, and R-M1. Measurable only because Task and AgentSession are different things. |
| Seats | `CONTEXT.md` § Seat cost, and R-D4. Seat cost is **46.2%** of Total spend on the committed fixture, and a consumption-only model cannot see it. The fixture's volume is deliberately low so that it does not get buried. |
| Default | [ADR-0003](adr/0003-individual-visibility-is-open-by-default.md), and the two stricter positions it supersedes. |
| Not a performance review tool | `/demo/people` sorts by Completed Jobs descending — an ordering by output rather than by spend, chosen and recorded rather than defaulted into (R-N15). No percentile is computed and no ordering is presented as a verdict. |
