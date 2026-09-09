# Landing — Shape A: two readers

Status: draft for the human, 2026-09-10. Opened by ticket 59. Nothing here is live.

**The shape.** One page, one bill, two people who read it. The hero states what the product measures;
the body splits into two columns, one per reader, each with its goals and the surface behind each
bullet; a numbered thirty-second path shows real figures from the demo before the visitor clicks;
two entry points send each reader to the page that answers their question first.

**What it keeps from the current landing.** Cost per completed Job stays the spine. Nothing on the
page says the words the smoke test forbids (`faster`, `productiv`, `velocity`, `ship more`, `10x`),
so the refused claim is still refused. Every figure quoted is on the committed fixture and can be
checked on `/demo`.

**What it changes.** The `<h1>`, the single-link rule (R-N1), and the *"not a performance review
tool"* line in `docs/positioning.md`, which this shape has to restate rather than drop. See § Tension
at the end.

---

## Copy

### Hero

> **The agent bill, read per finished task. For the leader who signs it, and for the engineer who
> runs it.**
>
> Every session is priced, keyed to an issue and a person, and counted only when its work was
> accepted. Attempts that finished nothing stay in the cost. That gives leadership a figure it can
> defend, and every engineer a figure they can act on.

### Column one — engineering leadership

Eyebrow: **Cost control · cost evaluation · who runs agents well**

- **One figure joins spend to output.** Cost per completed Job, with every failed attempt in the
  numerator. This month on the demo: **$27.02**, out of **$1,107.92** spent.
- **Three levers move it, and each has a page.** Model mix, where the price spread across tiers is
  **200×** on input. Rework, where a Job that took three attempts cost three times. Seats, where a
  seat held against near-zero use is the most expensive unit of work in the organisation: **46%** of
  Total spend on the demo.
- **See who has learned to run agents well.** Twenty people, sortable by completed Jobs, cost per
  Job and tokens, each shown beside the median of the people doing the same kind of work in the same
  repository. Ordered by output, never by spend.
- **See who is paying for a machine to host a chat.** Every supervised session splits into
  interactive, idle and unattended time, so you can tell where a remote machine did work while nobody
  watched, and where it sat waiting for someone to type.
- **Know where the month lands.** A projection of the current month, labelled as the estimate it is.
- **Open by default.** Everyone in the organisation sees the same figures on the same terms.
  Restrict by Role when you must, and the page loses rows, not features.

### Column two — the individual contributor

Eyebrow: **Find the people to learn from**

- **Your own figures, always, by name.** Completed Jobs, cost per Job, tokens processed, and the mix
  of templates you run. No percentile, no rank, no badge.
- **Beside the people doing work like yours.** Your numbers next to the median for your repository
  and template, with the group named and sized: *api-gateway · implementation, 6 members*.
- **Open their profile.** Under the open default you can read how a colleague who finishes more per
  dollar actually runs: which templates, which models, how much of their time is unattended.
- **Your rework, counted.** How often one of your Jobs needed a second attempt, and on which
  templates it happens.
- **Symmetric.** If they can see yours, you can see theirs. Nobody is ranked, and no ordering is a
  verdict.

### The thirty-second path

Heading: **What you see in the first thirty seconds**

1. **Four tiles, one argument.** What the month cost, **$1,107.92**. What it produced, **41**
   completed Jobs. What kind of work that was: 16 implementation, 13 bug fix, 10 review, 5
   refactor, 1 deploy. And the rate that joins the first two: **$27.02** per completed Job.
2. **People.** Twenty Members, each with their Jobs, tokens and cost. Open one and their figures sit
   beside the median of their comparison group.
3. **Switch accounts from the header.** The table goes from twenty rows to one, the navigation does
   not change, and a sentence above the table says why. Same page, fewer rows.

### Entry points

Two links, side by side:

> **Read it as leadership** → the Summary, then Spend.
> **Read it as an engineer** → your own profile on People, beside your comparison group.

Under them, one line:

> Two seeded accounts, no password. Switch between them from the header at any time.

### Second screen — `/sign-in`

The current heading, *"Continue as"*, is the obscure step the visitor meets after the hero. Proposed:

> **Choose who to be.**
>
> Two seeded accounts, no password. They differ only in what their Role can see; the navigation is
> identical for both. You can switch from the header on any page.

The two cards keep their present Role lines. The button label stays *"Continue as <name>"*, because
the enforcement e2e clicks it by text.

---

## What each bullet is held to

| Bullet | Surface, requirement or record |
|---|---|
| $27.02 / $1,107.92 / 41 / template counts | `/demo` summary tiles on the committed fixture, September 2026, partial month (`README.md` § 2) |
| 200× on input | ADR-0007 |
| Rework costs three times | `CONTEXT.md` § Rework; R-M1 |
| Seats 46% of Total spend | `CONTEXT.md` § Seat cost; R-D4; `docs/positioning.md` |
| Sortable People table, ordered by output | `/demo/people`, R-N15, R-M15, A24 |
| Beside the comparison group median, named and sized | `/demo/people?member=`, R-N17, `spec.md` § 11 C4 |
| Interactive / idle / unattended split | `/demo/work` panel 6, R-N14, `CONTEXT.md` § Duration spans |
| Projection, labelled an estimate | `/demo/projection`, R-N23…R-N25 |
| Open by default, symmetric, restrict by Role | ADR-0003, R-A8, R-A9 |
| Your own figures, always | R-A3.1 (`self` over every class, to every Role) |
| Open a colleague's profile | `org-member` scope under the open default (ADR-0003); the profile carries WorkType mix and the comparator (R-N16) |
| Twenty rows to one | `README.md` § 2 step 4; `e2e/enforcement.spec.ts` |

Two bullets promise slightly more than the profile shows today, and would need a small addition:

- *"which models"* on a colleague's profile: model mix is on `/demo/spend` at the population the
  viewer selects, not on the Member profile. Either the bullet drops the word, or the profile gains a
  Model-mix chart (a ViewModel the façade already produces for Spend, re-scoped to one Member).
- *"how much of their time is unattended"* per Member: presence spans exist on `/demo/work` at
  population grain, with a subject control. Same choice: drop the clause, or add the panel to the
  profile.

## Tension with the record

**"Not a performance review tool."** `docs/positioning.md` lists it under *Not*, and ADR-0003 records
why: the two named products that ranked people on agent usage were withdrawn within days, and one of
them raised the compute bill it was meant to control. Column one asks the reader to find *who has
learned to run agents well*, which is the same data read the other way round. The shape keeps the
product on the defensible side of that line by three choices already in the code: ordering by output
rather than spend, a named comparison group instead of a percentile, and symmetric visibility. The
copy says "who runs agents well" and never "performance", because every vendor in brief 15 that
shows named usage justifies it as enablement or budget, and none as evaluation. If the human wants
the word *performance* on the page, `positioning.md` § Not has to change first, and ADR-0003's
Consequences section should record that the position moved.

**R-N1's single link.** `page.test.tsx` and `smoke.spec.ts` both assert exactly one link, to
`/sign-in`. This shape has two entry points. Both can still go to `/sign-in`, each carrying a query
parameter naming where to land; the sign-in form writes it into a hidden `return_to` field, which
`POST /api/session` already accepts and validates as same-origin and under the token's Organization
(R-A2, R-A7, R-T13). No endpoint change, and the visitor stays on the no-JavaScript path. The two
tests then assert two links, both to `/sign-in`.

**The `<h1>`.** Asserted verbatim in both tests and named in `positioning.md` as where the one-liner
is held. Changing it is a copy change plus two string updates plus one row in the positioning table.
