# Landing — Shape C: the VP of Engineering's jobs, stack-ranked, then four cards

Status: draft for the human, 2026-09-10, replacing Shapes A and B after the human's reading: the
selling point is addressed to the decision maker, the individual contributor's benefit is a side
effect, and the page is derived from jobs-to-be-done rather than from features or actors. Opened
by ticket 59. Nothing here is live.

Every figure below is computed from the committed fixture (`src/fixtures/data/`) over its 150-day
window, 2026-04-12 to 2026-09-08. Where `/demo` shows the same figure, the two agree to within a few
cents; the demo's own numbers are the ones to quote on the page once it is built.

---

## 1. First principles: what a VP of Engineering is actually paying for

A VP of Engineering answers for two things: a delivery commitment and a budget. Agents entered the
budget as a new, growing, consumption-priced line attached to a premise nobody can prove, and the
VP now has four recurring conversations about it:

| Conversation | With | The question in it |
|---|---|---|
| The bill | CFO, finance | *What did we get for it?* |
| The allocation | Their own leads | *Where should we push agents harder, and where should we stop?* |
| The investment | CEO, board | *Is it working, and is it getting better?* |
| The organisation | Themselves | *Who has figured this out, and how do I make the rest run like them?* |

"Performance efficiency of the organisation" is one ratio: work delivered per unit of input. The
input is money and engineer time; the output is finished work. Every job above is that ratio read
at a different grain: total, by work class, over time, by team. That is what the page has to sell,
and it is what no other agent platform sells: `[E]` brief 15 § 9 G3 found no agent platform that
reports cost per completed unit of work, and the buyer asking for it by name is finance, not
engineering.

## 2. The value points, stack-ranked

Ranked by how much the VP's decision changes when they see it, times how far they are from getting
it anywhere else. Each carries the fixture evidence that would sit behind it.

**1. A unit cost for delivered work, and which way it is moving.**
Cost per completed Job, month over month. On the fixture, complete months only:

| Month | Total spend | Completed Jobs | Cost per completed Job |
|---|---|---|---|
| May | $1,573 | 60 | **$26.22** |
| June | $1,399 | 61 | **$22.93** |
| July | $1,904 | 110 | **$17.31** |
| August | $2,144 | 150 | **$14.30** |

Spend rose 36% and unit cost fell 45%, because the denominator grew 2.5×. This is the number the
VP carries into every one of the four conversations, and every other item on this list is a
decomposition of it. Ranked first because nothing else can be ranked without it.

**2. The share of the bill that bought nothing, decomposed into what to do about it.**
Of $9,117 total spend over the window:

| Segment | Amount | Share |
|---|---|---|
| Attempts that were accepted | $3,335 | 37% |
| Attempts that were not accepted | $1,571 | 17% |
| Seats | $4,212 | 46% |

Only 37 cents of every dollar landed on an attempt that was accepted. Inside the other 63 cents:
103 of 570 Tasks needed a second attempt, and the attempts after the first cost $607; one seat ran
three sessions in 150 days and cost $234 to hold. `[E]` Brief 15 § 9 G1: spend on failed attempts is
the one cost category that can be reduced without reducing output. Ranked second because it is the
most actionable number on the page, and because 46% in seats is invisible to every consumption
dashboard the VP already has.

**3. Where agents convert, and where they burn.**
Session cost per completed Job, by Repository × template, with the acceptance rate of attempts:

| | implementation | bugfix | refactor | review | deploy |
|---|---|---|---|---|---|
| web-console | $7.28 · 87% | **$4.13 · 96%** | $5.77 · 70% | $4.91 · 100% | $12.89 · 42% |
| mobile-app | $11.56 · 69% | $11.22 · 77% | $10.24 · 55% | $4.67 · 85% | — |
| api-gateway | $11.22 · 68% | $21.90 · 74% | $12.37 · 57% | $10.24 · 84% | **$28.96 · 32%** |
| ml-scoring | $13.31 · 59% | $11.79 · 68% | $17.93 · 50% | $7.17 · 75% | $24.76 · 26% |
| terraform-infra | $21.15 · 50% | $11.76 · 53% | $14.87 · 38% | $11.57 · 67% | $28.20 · 20% |

The same agents, the same organisation, a 7× spread by where they are pointed. Deploy converts one
attempt in three and costs $19 per completed Job against $6.62 for review. `[E]` Stanford's
segmentation (brief 15 § 8.2) says the effect of agents runs from strongly positive to net negative
by task class, so an aggregate that does not condition on work class is confounded; this grid is
the conditioning. Ranked third because it is the allocation decision, which is the one the VP makes
monthly rather than quarterly.

**4. The spread inside the organisation, and what the cheapest-run team does differently.**
Session cost per completed Job by Team (Teams overlap; 4 of 20 Members sit in two):

| Team | Cost per completed Job | Acceptance | Headless share | Frontier share of token cost |
|---|---|---|---|---|
| Product | **$9.55** | 71% | 31% | 50% |
| Platform | $10.28 | 66% | 32% | 44% |
| Data | $12.87 | 68% | 29% | 50% |
| Infrastructure | $13.04 | 60% | 43% | 53% |

The cheapest-run Team is 27% cheaper per Job than the most expensive, and the model mix is nearly
identical across all four, so the difference is acceptance, not tier choice. At Member grain the
spread is 3×, from $5.55 to $17.51 per completed Job, median $10.76. This is where *"identify the
best operators"* lands: as practice to spread, read against a named comparison group, not as a
ranking. `[E]` Every vendor in brief 15 that shows named usage justifies it as enablement or budget,
never evaluation. Ranked fourth because it needs the first three to be trusted before anyone acts on
it, and because it is where the ADR-0003 record bites hardest.

**5. Whether the cloud is earning its machine time.** 35% of attempts run headless; on supervised
sessions 32% of machine time is unattended and 26% idle; 148 of 742 attempts fanned out, and machine
hours run 1.09× wall clock. Real, and the answer to the sceptical prior, but a VP acts on 1–4 first.
Folded into item 4's illustration as a secondary reading rather than given a card.

**6. Accountability by construction.** Every session keyed to an issue, a person, a repository and a
template; open by default, restrictable by Role. A hygiene factor: it is why the numbers above can
be trusted, not a reason to buy. One line under the cards.

**7. The individual contributor's view.** The same comparator, opened by the engineer on themselves.
`[E]` The best-evidenced vantage point in the record (Meyer et al., CSCW 2018, brief 03), and a real
adoption lever, but a side effect of item 4, not a selling point. One clause, in item 4's copy.

## 3. Folded into four cards

The page is a hero, four cards in a row, one line, one button. Each card is a claim in the VP's
words, a chart the visitor can read in ten seconds, and one sentence saying what to do about it.

### Hero

> **What your agents cost per finished Job. Where they convert, where the money leaks, and who
> has it figured out.**
>
> One bill, read four ways, on your organisation's own sessions. No claim that anyone delivers
> more than before, because no one can measure that; a unit cost you can defend, because every
> attempt is in it.

### Card 1 — Your unit cost, and which way it is moving

**Chart.** Four columns, one hue, complete months May to August: Cost per completed Job $26.22,
$22.93, $17.31, $14.30. The last column carries the hero figure. Delta caption: *−45% since May, on
2.5× the Jobs.*

**Sentence.** The number for the CFO. Failed attempts and idle seats are in it, so it cannot be
gamed by running more.

### Card 2 — 37 cents of every dollar landed on accepted work

**Chart.** One horizontal segmented bar of Total spend over the window, three segments with 2px
gaps: accepted attempts 37%, attempts not accepted 17%, seats 46%. The accepted segment in
de-emphasis gray; the two others carry hue, because they are the point. Direct labels on all three.

**Sentence.** The two coloured segments can be cut without cutting output: 103 Tasks needed a second
attempt, and one seat ran three sessions in five months.

### Card 3 — Where agents convert, and where they burn

**Chart.** A 5 × 5 heatmap, Repository rows by template columns, session cost per completed Job on
a single-hue sequential ramp, the value in each cell, the acceptance rate under it in muted ink.
One empty cell (mobile-app never deploys). Two cells called out: *$4 at 96%* and *$29 at 32%*.

**Sentence.** Push agents where the grid is light. Where it is dark, change the template or take
the work back.

### Card 4 — Your cheapest-run team is 27% cheaper per Job. The difference is acceptance

**Chart.** Two small bar charts sharing one Team order, emphasis form: cost per completed Job
($9.55, $10.28, $12.87, $13.04) and acceptance rate (71%, 66%, 68%, 60%), the cheapest Team in the
accent hue and the rest in gray. Footnote: *Teams overlap; 4 Members are counted twice.*

**Sentence.** Open the team, then the people, then what they run: template, model tier, unattended
share. Every engineer sees the same comparison for themselves, against people doing the same
work, and nobody is ranked.

### Under the cards

> Every session is keyed to an issue, a person, a repository and a template, and priced before it
> reaches this page. Open by default to everyone in the organisation; restrict by Role when you must.
>
> **Open the demo** — two seeded accounts, no password.

The illustration of all four cards: [`img/shape-c-cards.png`](img/shape-c-cards.png), rendered
from [`img/shape-c-cards.html`](img/shape-c-cards.html) with the reference data-viz palette. The
live page would use the app's own chart tokens from `src/app/globals.css`.

## 4. What this shape is held to, and what it disturbs

| Claim | Held to by |
|---|---|
| Cost per completed Job by month | `/demo` tile 4 with the month picker; `CONTEXT.md` § Metric Concepts; R-M1 |
| The three-segment split | `/demo/spend` panel 2 (session vs seat), R-M1's `accepted` filter on Cost per session; the accepted / not-accepted split of session Cost is not a shipped panel and would need one |
| Repository × template grid | `/demo/spend` Cost by Repository and the WorkType control give each cell one at a time; a grid panel does not exist and would need one |
| Team comparison | `/demo/spend` and `/demo/work` with the subject control set to a Team; acceptance by template on `/demo/work` panel 2 |
| Member spread 3× | `/demo/people`, sortable; quoted as a range, never as a list |
| No productivity claim | `spec.md` § 1; none of `faster`, `productiv`, `velocity`, `ship more`, `10x` appears in the copy above |

**Two of the four charts are not shipped panels.** The segmented waste bar and the grid are both
one `ChartViewModel` each from rows the façade already aggregates, and both are exactly the kind of
panel `docs/roadmap.md` § Then describes under *a recommendation per WorkType*. If the landing shows
them, the product must too, or the landing promises what the demo cannot deliver.

**The `<h1>` and the single link** change as recorded on ticket 59; one link to `/sign-in` keeps
R-N1's tests at one link.

**"Not a performance review tool."** Card 4 stays on the recorded side: Team grain on the page,
the Member spread as a range, the comparison group named, no ordering presented as a verdict.

## Sources

`.scratch/agent-dash/research/15-actionable-signal-landscape.md` § 8.2, § 9 G1, G3;
`.scratch/agent-dash/research/03-jtbd-and-demo.md`; ADR-0003; `CONTEXT.md` § Seat cost, § Rework,
§ Output comparability; the committed fixture under `src/fixtures/data/`.
