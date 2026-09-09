# Landing — Shape B: the swarm, and what it is worth to an organisation

Status: draft for the human, 2026-09-10. Opened by ticket 59. Nothing here is live.

**The shape.** The page opens on the thing being bought, a swarm of cloud agents, rather than on the
dashboard. It names the four situations in which moving agent work off laptops pays, pairs each with
the figure on `/demo` that tells an organisation whether its own work is in that situation, says
plainly when it does not pay, and states what the dashboard refuses to claim. The dashboard is
introduced as the instrument, not the hero.

**Who it is for.** The engineering leader, or the head of a department that has one, deciding whether
the remote infrastructure is earning its line on the bill. Individual contributors are not addressed
by name on this page; Shape A does that.

**What it keeps.** Cost per completed Job as the joining figure; no productivity claim; every number
on the committed fixture.

---

## Copy

### Hero

> **Agents that run while nobody is at the keyboard. Here is what they cost per thing they
> finished.**
>
> Moving agent work off laptops and into a cloud pays in four situations, and not otherwise. This
> dashboard tells an engineering organisation which of the four its own work is in, on its own
> data.

### The four situations

Heading: **When a swarm pays, and how you would know**

Four cards, each with a claim, a sentence, and the figure that tests it.

**1. When the work runs unattended.**
Overnight, or while the engineer reviews something else. A laptop closes; a cloud session does not.
*How you would know:* every supervised session on the Work page is split into interactive, idle and
unattended time, and headless sessions filter separately. If unattended time is a sliver, the cloud
is hosting a chat.

**2. When one task fans out.**
One attempt, several agents, several machines at once. Two agents holding two machines for an hour
is two machine hours inside one hour of work, and a laptop cannot do it.
*How you would know:* agents per session, median and p95, and machine time set against wall-clock
time. Sub-agents roll into the attempt that spawned them, so the figure is per attempt, never per
process.

**3. When the job needs a bigger machine than a laptop.**
Builds, test suites, migrations, the CI-shaped work that is heavy on the machine and light on
tokens.
*How you would know:* machine time is priced into every session's Cost alongside its tokens, so a
session that burned an hour of compute and few tokens shows up in money where a token count would
miss it entirely.

**4. When someone has to answer for the spend.**
No session launches without an issue key, a person, a repository and a template. A laptop session
has none of those and leaves no row.
*How you would know:* Cost per completed Job by template and by repository, and every aggregate
opens to the raw sessions under it.

### When it does not pay

> **A short, supervised edit does not need a remote machine.** One person, one small change, the
> engineer watching every step. A laptop with an LLM does that for the API price and no machine
> time. The dashboard does not hide this case: a supervised session with a short wall clock and
> almost no unattended time is a remote machine hosting a conversation, and it is priced like one.

### What this dashboard will not tell you

> It will not tell you that your engineers deliver more than they did before agents. Measuring that
> needs a baseline from before, and the window it observes is entirely agent-assisted. What it gives
> you instead is your own cost per completed Job, month against month, with the rework and the idle
> seats inside it broken out. The number you compare it against is yours to supply.

### The thirty-second path

Heading: **Thirty seconds on the demo**

1. **Four tiles.** **$1,107.92** spent this month. **41** completed Jobs. Their split by template.
   **$27.02** per completed Job.
2. **Spend.** Where the money went: session cost against seat cost, **46%** of the total in seats on
   this organisation. Model mix at three zoom levels.
3. **Work.** Whether the agents are working: acceptance by template, rework, what is stuck, how
   long sessions run, and how much of that time a human was present for.
4. **Switch accounts.** The restricted account sees the same pages with fewer rows and no cost
   column. Nothing is hidden; the rows are simply not there.

### Entry point

> **Open the demo.** Two seeded accounts, no password.

### Second screen — `/sign-in`

As in Shape A: heading *"Choose who to be."*, the supporting sentence extended with *"You can switch
from the header on any page."*

---

## What each card is held to

| Claim | Surface, requirement or record |
|---|---|
| Interactive / idle / unattended split; headless filtered separately | `/demo/work` panel 6 and the `execution_mode` control, R-N14, R-C2, `CONTEXT.md` § Duration spans |
| Agents per session, median and p95; machine time against wall clock | ADR-0008; `/demo/history` shows the tree; `CONTEXT.md` § Machine allocation |
| Machine time priced into Cost | `CONTEXT.md` § Cost and § Machine allocation; ADR-0005 |
| Issue key required at launch | `CONTEXT.md` § Task, *externally keyed* |
| Cost per completed Job by template and repository | `/demo/spend` panels, R-N9 |
| Every aggregate opens to raw rows | `/demo/history`, R-N19…R-N22 |
| 46% in seats | `docs/positioning.md`, R-D4 |
| No productivity claim | `spec.md` § 1; `e2e/smoke.spec.ts` |

Two cards lean on figures the product carries but does not yet expose the way the copy implies:

- **Card 2, "machine time set against wall-clock time".** Both quantities exist on a root session
  (machine allocation sums children; wall clock does not), but no panel plots their ratio. Today the
  reader sees agents per session and can open a session to read both durations. Either the sentence
  weakens to *"agents per session, and the machine hours behind one hour of work on any session"*,
  or Work gains a seventh panel.
- **Card 3, machine-heavy and token-light sessions.** Cost is blended at session grain and *"a
  session never presents the two separately"* (`CONTEXT.md` § Cost). The claim as written is
  true, since such a session's Cost is high, but a reader cannot point at the machine share. The
  card should not promise a split it cannot show; the wording above stops short of one. The roadmap's
  BYOK item (ADR-0010) is where a token / machine split would arrive.

## Tension with the record

**The page argues for the platform, not only for the dashboard.** Nothing in the record forbids that,
but ticket 37's restraint argument was that a product declining to claim a productivity gain should
not open by listing what it does. Shape B opens by listing what the *platform* does, in conditional
form, and the refusal is stated on the page. That is a different posture from the current hero and
should be chosen knowingly.

**The refused claim survives, and the regex agrees.** None of `faster`, `productiv`, `velocity`,
`ship more`, `10x` appears in the copy above. The refusal block deliberately says *deliver more*
rather than *ship more*, because `page.test.tsx` matches the latter; a first draft of this file
tripped exactly that.

**R-N1 and the `<h1>`.** One link, to `/sign-in`, so the single-link tests hold. The heading changes,
so the two string assertions and the `positioning.md` table row change with it.
