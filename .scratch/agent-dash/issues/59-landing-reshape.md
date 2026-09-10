Type: grilling
Status: resolved
Blocked by: 37, 49
Label: resolved

# Reshape the landing: two readers, and the swarm's value to the organisation

**Human-owned.** This is a positioning decision, not an implementation task. The drafts exist so
the human chooses between shapes rather than writes from nothing; nothing is live and no test has
been changed.

## Question

The landing (ticket 37) is one line and one link. The human's reading on 2026-09-10: it is obscure,
it offers no teaser to go further, and it shows none of the value an analytical dashboard over agent
use would carry. What should `/` and `/sign-in` say instead, for whom, and what does that do to the
positioning of 2026-09-09?

## What the human said the value is

Recorded close to verbatim, because it moves the positioning and the ADR-0003 record should be read
against it:

- Most of the value is in identifying the best experts operating with agents and the low
  performers, and at the same time understanding whether the infrastructure returns enough compared
  with engineers running LLMs locally.
- The sceptical prior: offloading to a remote machine is not obviously better than local execution
  unless the work is resource-intensive, in the way distributed compilation and heavy CI are.
- Two actors with distinct goals. **Engineering leadership:** cost control, cost evaluation, and
  assessment of how individuals perform. **Individual contributors:** figuring out which peers could
  help them learn their ways of operating agents.
- Wanted: two shapes of the landing with marketing copy and bullets per actor, and a brief on the
  key value proposition of a swarm of cloud agents with LLM sessions for an engineering
  organisation, or any organisation with an engineering department.

## Drafts

- `docs/landing/shape-a-two-readers.md` — one page, two columns, one per reader, two entry points.
- `docs/landing/shape-b-swarm-and-organisation.md` — the four situations in which a swarm pays,
  each with the figure that tests it; when it does not; what the product refuses to claim.
- `docs/landing/value-proposition-brief.md` — the mechanisms, the ROI question answered as far as
  the data allows, the two readers' goals mapped to surfaces and gaps.
- `docs/landing/README.md` — the index and a recommendation: A's structure with B's two honesty
  blocks folded in.

## What the decision disturbs

1. **`docs/positioning.md` § Not — "a performance review tool".** The leadership column asks who
   runs agents well and who does not, which is the same rows read the other way. The drafts stay on
   the defensible side by the three choices already in the code (ordered by output, named comparison
   group, symmetric visibility; R-M15, R-N17, ADR-0003) and never use the word *performance*. If the
   human wants that word on the page, the *Not* line changes first and ADR-0003 § Consequences
   records that the position moved. Brief 15 § 3.5 and ADR-0003 carry the two withdrawals.
2. **The `<h1>`.** Asserted verbatim in `src/app/page.test.tsx` and `e2e/smoke.spec.ts`, and named
   in the positioning table as where the one-liner is held. Any new hero changes both strings and
   that row.
3. **R-N1's single link** (Shape A only). Two entry points, both to `/sign-in`, each carrying a
   query parameter that the sign-in form writes into a hidden `return_to` field. `POST /api/session`
   already accepts and validates that field (R-T13), so no endpoint change is needed. Two tests then
   assert two links. The no-JavaScript sign-in path is unchanged.
4. **`/sign-in`'s heading**, *"Continue as"*, asserted in `smoke.spec.ts`. Both shapes propose
   *"Choose who to be."* The button labels stay, because `enforcement.spec.ts` clicks them by text.
5. **The refused claim is kept.** Neither shape uses `faster`, `productiv`, `velocity`, `ship more`
   or `10x`; Shape B states the refusal on the page in words that pass the regex.
6. **Two bullets promise a little more than the profile shows.** Model mix and unattended share per
   Member are population-grain today. Either the words drop or the profile gains two panels from
   ViewModels the façade already produces. Listed in Shape A § *What each bullet is held to*.

## Done when

The human has picked a shape, or a fold of the two, and written or approved the hero line. Then an
implementation ticket carries the code, the two test updates, the positioning-table row, and the
`?next=` parameter if Shape A's entry points are kept.

## Comments

### 2026-09-10 — the human read A and B and set both aside

Neither shape is right. The goal is the jobs-to-be-done perspective; the selling point is addressed
to the decision maker; the individual contributor's benefit is a side benefit, not a primary key.
Think from first principles as a VP of Engineering interested in the performance efficiency of the
organisation. Stack rank the value points first, then fold them into four bullet-like items with
chart illustrations, so a visitor sees something before the demo and is motivated to try it.

**Answered in `docs/landing/shape-c-vp-jobs.md`.** Seven value points ranked with fixture evidence;
the top four become the cards: unit cost and its direction ($26.22 → $14.30 per completed Job, May
to August), the share of spend that landed on accepted work (37%, with 17% on failed attempts and
46% on seats), the Repository × template grid of cost per completed Job (a 7× spread), and the
Team spread (27%, the difference being acceptance rather than model tier). Rendered as
`docs/landing/img/shape-c-cards.png`.

**Two of the four charts are not shipped panels** (the three-segment split of Total spend and the
Repository × template grid). If the landing carries them, the demo must too. Both are one
`ChartViewModel` each from rows the façade already aggregates; the implementation ticket should
carry them alongside the copy.

### 2026-09-10 — competitor read, on the human's ask

Shape C read as *okay-ish but thin*. The human asked who the true competitors are, Zencoder
included, and what the top three's value propositions say in positioning and reviews, for
inspiration. Answered in `docs/landing/competitors.md`: the set splits into native platform
analytics and the measurement layer; the top three are Zencoder (incumbent and host), Claude Code
Analytics (the reference native dashboard), and Jellyfish AI Impact (the measurement-layer leader).
Five edits to Shape C follow from it, listed in that file's § 4; none reopens the refused claim.

### 2026-09-10 — picture v1

The human supplied a landing-page guide (eleven elements, pick a bold direction) and asked for a fit
and a picture to iterate on. Fit: **editorial ledger** (Fraunces + Manrope, paper with rules, navy
ink, blue for data only). Full page rendered at `docs/landing/img/picture-v1.png`; choices and
adaptations in `docs/landing/picture-v1.md`. Social proof and testimonials are adapted honestly:
the demo organisation's own figures, and attributed research quotes, because no customers exist.

### 2026-09-10 — picture v2, the lean one

The human read v1 as too crowded and asked for something truly minimal while keeping the four
blocks and their wording, with the visualisations dropped. v2 is slogan, paragraph, one link, four
text blocks each with one figure set as type. `docs/landing/img/picture-v2.png`. R-N1's single link
holds again: one anchor on the page, to `/sign-in`.

### 2026-09-10 — v2 stripe and new figures

Demo figures now sit in one band across the four blocks, labelled *Figures from the demo
organisation* in its top right corner, so mock data is visibly separate from the offer above and the
action below. The human supplied new figures ($76.50 per Job up 18% from May on 1.4× Jobs; 19% leak;
$7 to $144; 14% cheaper team). Dependents were recomputed for consistency: May $64.83, 81 cents
accepted, 20× spread, $68.40 against $79.50, 41 of 570 Tasks reworked. **These no longer match the
committed fixture**; if this copy ships, the fixture targets change or the figures are read live
from the demo organisation.

### 2026-09-10 — handed to build

Final copy edits (lede loses its last sentence, "agent use", the do/spend/solve slogan) are in the
render. The human answered the four open questions (hardcoded figures, fonts on the two public
routes only, MCP line shipped with a roadmap item, sign-in as a mock provider page with one demo
action). Everything is specified in **ticket 60**, `60-landing-v2.md`, which is `ready-for-agent`.
This ticket resolves when 60 lands.

### 2026-09-10 — resolved by ticket 60

Landed: `/` is the slogan, the paragraph, one link and the four reads; `/sign-in` is the mock
provider page with one demo action. Copy, layout, tests and docs are as specified in
`60-landing-v2.md`; the positioning revision is recorded in `docs/positioning.md` § Revision —
2026-09-10, and the MCP surface the landing promises is first under *Next* in `docs/roadmap.md`.
