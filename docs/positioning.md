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
| One line | `src/app/(public)/page.tsx`, the landing's `<h1>`: *What your agents do, spend and solve, per finished job.* (revision of 2026-09-10, below). The 2026-09-09 line survives in `README.md` § 1's argument; the hero no longer carries it. |
| Claim | **Cost per completed Job**, the fourth tile on `/demo` and the ratio `/demo/spend` opens with (`CONTEXT.md` § Metric Concepts; `spec.md` R-M1, *"the join"*). |
| Refused claim | `e2e/smoke.spec.ts` — the landing is asserted against `/faster\|productiv\|velocity\|10x/i`. `spec.md` § 1 carries the argument. |
| Model mix | ADR-0007. The 200× is a property of this project's roster and is stated as one. |
| Rework | `CONTEXT.md` § Rework, and R-M1. Measurable only because Task and AgentSession are different things. |
| Seats | `CONTEXT.md` § Seat cost, and R-D4. Seat cost is **46.2%** of Total spend on the committed fixture, and a consumption-only model cannot see it. The fixture's volume is deliberately low so that it does not get buried. |
| Default | [ADR-0003](adr/0003-individual-visibility-is-open-by-default.md), and the two stricter positions it supersedes. |
| Not a performance review tool | `/demo/people` sorts by Completed Jobs descending — an ordering by output rather than by spend, chosen and recorded rather than defaulted into (R-N15). No percentile is computed and no ordering is presented as a verdict. |

---

## Revision — 2026-09-10

Recorded from [ticket 59](../.scratch/agent-dash/issues/59-landing-reshape.md) and built as
[ticket 60](../.scratch/agent-dash/issues/60-landing-v2.md). The 2026-09-09 text above is kept
unedited; this block is what moved.

**One line:** What your agents do, spend and solve, per finished job.

**Audience:** the VP of Engineering who asked what agent use returned.

**Held to:** the four reads on `/` — unit cost and which way it is moving; where the spend leaks;
where the same agents convert, by repository and template; and where the cloud earns its keep,
by how much of the work runs with nobody at the keyboard. Each read is a claim, a figure from the
demo organisation, a reading, and a verb. The figures on the landing are the human's copy for the
MVP, labelled *Figures from the demo organisation*, and do not match the committed fixture.

Everything else above holds: the claim, the refused claim (the smoke test still forbids the
vocabulary on both public pages), the levers, the default, and the *Not* line — the reads never
use the word *performance*.
