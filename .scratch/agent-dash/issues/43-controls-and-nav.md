Type: implementation
Status: resolved
Blocked by:
Label: resolved

# Control bar, panel-local toggles, active-filter sentence, nav, History dates

## Goal

Spend shows nine control groups and Work ten, in two rows. Half of them change one panel.

## Scope

1. **Global bar keeps**: Period, Grain, Subject, Repository, Template. One row at 1440.
2. **Panel-local**: Accepted, Measure (Raw / Per capita), Model level (Exact / Family / Tier), Mode
   (interactive / headless) move into the header of each panel that reads them. A toggle that
   reaches two panels renders on both, bound to one query param. Params and URLs do not change.
3. **Active-filter sentence** under the page heading: "Week grain · by Team · mobile-app · all
   templates". Reset stays as is.
4. **Nav**: History and Projection become nav items. The "⋯" overflow is removed. Secondary weight
   is allowed (smaller, right-aligned), hidden is not.
5. **History**: date inputs apply on change. The Apply button goes. Native date input, browser
   locale.

## Done when

- e2e: at 1440 the global bar on Spend has five groups; each moved toggle is found inside its
  panel's header; the URL after a toggle click is unchanged from today's.
- e2e: nav has six links, no overflow button.
- e2e: History changes range with no Apply click.

## Notes

Decided by the human, 2026-09-09, rounds 1, 2 and 3. Ticket 45 also edits the toolbar, so run
this first and 45 after.

## Comments

### 2026-09-09 — implemented (AFK wave 2, on `main`)

`lint` 0 errors · `typecheck` clean · `test` **1226** across 57 files · `test:coverage` 98.1% /
87.8% · `build` clean · `e2e` **128 passed**.

**Two new tables, and R-C1 was not one of them.** R-C1 says *which* controls a page has; the new
**R-C6** says *where each one stands*, and they are separate questions. `DECLARED_CONTROLS` is
untouched, so the parse, the serialise, the defaults and the "a page reads only what it declares"
rule are all exactly what they were. `PANEL_LOCAL_CONTROLS` in `params.ts` is the second table, and
`toolbarControls`/`panelLocalControls` are derived from the two so they are a **partition** of the
declared set on every page — asserted, because the cheap failure here is dropping a control from
both lists and passing every placement test.

**"Params and URLs do not change" is enforced by construction, not by care.** A panel-local control
renders the same `ControlWidget`, from the same `ControlSet`, through the same `controlHref` the
toolbar used. `page-toolbar.tsx` was split: the renderer table moved to `control-renderers.tsx`, and
both the bar and `PanelControl` call it. T-C14 asserts the `href`s against `controlHref` itself, and
T-E12 asserts the resulting URLs as literals — `?per_capita=1`, `?accepted=accepted`,
`?model_level=tier`, `?execution_mode=headless` — because "unchanged from today's" is a claim about
specific strings and a comparison against the code would pass whatever the code did.

**Where each moved toggle went.** `accepted` → Cost per session. Per-capita → Total spend **and**
Cost by Repository (the two additive money panels it divides; the three ratios beside them get
nothing, which is `perCapitaNote`'s sentence made visible). Model roll-up → the Model mix panel
inside the Adoption section, which is the scope R-C1 always gave it — and it is why the control no
longer has to spell "Model (Adoption)" in its own label. `execution_mode` → the acceptance
multiples and the duration panel. The global bar is five groups and one row at 1440px, measured in
T-E12 rather than eyeballed.

Panels take the control as a **rendered node**, never as a key: `PanelCard` and `WorkPanel` gained a
`controls` slot, and the page decides which panel reads what. Three of the panels involved are
Client Components, which is exactly why the node is a prop — a client module importing
`components/controls/` would pull `queries.ts` and `node:fs` into the browser bundle.

**A decision taken under the escalation rule: `execution_mode` renders on two panels, not on five.**
It is a row filter in `context.ts`, so it narrows the rows *every* panel on `/demo/work` reads —
velocity and the Job rates included. Rendering it on five headers would be five copies of one menu;
rendering it on two is R-C2 read literally (*"across duration and acceptance"*), and that is what
shipped. **The cost is real and is not papered over:** changing Mode on the duration panel also
changes the velocity chart above it, which shows no Mode control. The two honest alternatives were
both more expensive — make the filter itself panel-local (a query change that alters what a given
URL renders, which the ticket's hard constraint is adjacent to) or accept five copies. If the
velocity/rates coupling reads wrong on the built page, the cheap follow-up is a one-line note on
those two panels rather than a fifth widget.

**A second decision, on item 5: applying on change costs client JavaScript, and the guarantee it
threatened was worth more than the directory it lives in.** There is no JS-free way to submit a
`GET` form on `input`; the Apply button *was* the no-JS mechanism. But `components/controls/`
carries a structural guarantee — no `"use client"` anywhere in it, so `useState` is not in scope and
a mirror of the URL is not expressible (R-T25), asserted over the whole directory — and spending
that on one event handler would have meant editing the test that asserts it. So the handler is
`components/forms/auto-submit-form.tsx`, a new sixth directory under `components/`, holding a `GET`
form that submits itself when a field changes. It holds no state either: it reads the form element
the event handed it, calls `checkValidity()`, and submits. R-T25 is untouched, and
`technical-spec.md` § 2 and § 7 record both the directory and why it exists.

**The validity guard is doing real work, not decoration.** React's `onChange` on `type="date"` fires
on the `input` event, so typing a date fires it per keystroke; an incomplete date reads as `""`,
which `required` refuses, and a complete date outside the observation window fails the inputs' own
`min`/`max`. That is R-T26's coercion arrived at *before* the navigation instead of after it.
**What this costs: with JavaScript off, the date range can no longer be applied at all** — where
before it could, via Apply. Accepted rather than hidden: the product's charts are Recharts and
already need a browser, so a no-JS reading of `/demo/history` was already partial.

**The active-filter sentence (R-C7) names the off state of every filter, not just the set ones.**
"all templates" is in the line when nothing is chosen, because the question it answers is *what
population is this figure over* and an omitted phrase makes that answer depend on knowing what
could have been there. It follows the page's own declared controls, so `/demo/people` reads
"all teams · all kinds" rather than the same list with blanks in it. Period is excluded (the period
control prints its own value in the bar directly above) and so is sort (an ordering, not a
narrowing). It is absent, not empty, on `/demo` and `/demo/projection`.

**Nav.** One list of six, `secondary: boolean` replacing the overflow item's `description` — a
description is what a menu row needs to justify opening the menu, and a nav item does not. The two
secondary items are `text-xs`, right-aligned as a pair via `ml-auto` on the first of them, and both
remain plain links with `aria-current`. T-C16 asserts the six labels and `href`s as an ordered list
*first*, because "no disclosure" passes against a nav that renders nothing.

**Spec edits, in the same commit:** R-N2 (nav), R-N3 (shell), R-N20 (the date range), new R-C6 and
R-C7, and A32–A35 in § 10. `testing-spec.md` amends T-C6 and adds T-C14, T-C15, T-C16, T-E12, T-E13
plus the four § 9 rows. `technical-spec.md` § 2 (the directory tree) and § 7 (R-T25's structural
half). Every new identifier was checked against the whole repo first — R-C6/R-C7, A32–A35,
T-C14/15/16 and T-E12/13 were all genuinely free. **Note for whoever is counting: `T-C13` is
already used twice in `testing-spec.md` § 4.4** — the duration panel and the projection tiles — a
wave-1 collision left in place rather than renumbered here, since the IDs are referenced elsewhere.

**Left for ticket 45, deliberately.** The toolbar is smaller and its renderer table now lives in its
own module, which is the state 45 asked to build on. No copy in the bar was rewritten and no
as-of line was added.

**Verified on the built page at 1440px**, not only through the suite: five control groups in one
toolbar row on Spend, Measure in the Total spend header, Mode in the acceptance header, the filter
sentence under both ledes, six nav links with History and Projection right-aligned and smaller, and
`/demo/history` showing two native date fields in the browser's own `dd.mm.yyyy` order with no
Apply button.
