Type: implementation
Status: resolved
Blocked by: 32
Label: resolved

# Landing copy and positioning

**Human-owned.** This is a positioning decision, not an implementation task.

## Goal

Replace the placeholder hero with copy that states what this product actually claims.

## Why it is open

The hero currently reads **"Ship faster. Know why."** — written before the product had a point of
view, and now **inconsistent with a settled position**. Ticket 05 decided that **the product makes
no productivity claim**: measuring a gain requires a pre-agent baseline, the observation window is
entirely agent-assisted, and only period-over-period velocity is observable. "Ship faster" asserts
exactly the premise the product declines to assert.

That refusal is the more defensible position than either side of the METR disagreement, and it
retires ticket 03's question of whether to say the premise is contested out loud — **the product
never asserts the premise, so it has nothing to litigate.** The landing page must not reintroduce
it.

## Direction settled 2026-09-07

**Lead with the ratio** — what agent work costs per thing actually delivered — with the waste
mechanism as the supporting line. The two rejected directions: leading with the *refusal* to make a
productivity claim is intellectually the strongest position but opens on a negative, and the refusal
is better demonstrated by the dashboard's restraint than announced on the hero; leading with waste
alone states a mechanism before the thing it is a mechanism for.

**The line itself is still yours to write.** The direction is not the copy.

## What the copy has to carry

- The spine: **cost control**. The differentiator: **joining cost to efficacy**.
- The claim that is actually true of this product: attempts that produced nothing sit in the
  numerator and not the denominator of Cost per completed Task, so **waste raises the figure**.
- Nothing about speed, productivity gain, or engineers shipping more.

## Scope

`/` — minimal: the positioning line and one link to sign-in (R-N1). No feature grid, no pricing, no
comparison table; those are out of scope and were argued out.

## Done when

The human has written the line. Do not pre-answer this — the standing preference on this map is
that the human answers HITL tickets, and v1 was archived for exactly that failure.

### 2026-09-09 — the human wrote it

> **Agent spend, measured per finished task. Not per token, not per seat.**

The direction held: the ratio leads, waste is the supporting line, and nothing on the page says
anything about speed. `/` is the line, one supporting sentence and one link to sign-in.

**One word was changed on review, and one ambiguity was left in deliberately.** The first draft read
*"priced per finished task"*; "priced" is a vendor's verb and on a hero it reads as how this product
charges you, so it became "measured". *"Not per seat"* is a claim about the **unit reported**, not
about what the numerator holds — Total spend does include seat cost, about 48% of it, which is
R-D4's own headline finding. Kept, because the contrast is with per-seat and per-token *pricing
models*; recorded here and in `src/app/page.tsx` because a reader who takes it the other way will
find the apparent contradiction one click in.

`e2e/smoke.spec.ts` asserts the line and the absence of any productivity claim; `page.test.tsx`
asserts R-N1's scope — one link, and it goes to `/sign-in`.
