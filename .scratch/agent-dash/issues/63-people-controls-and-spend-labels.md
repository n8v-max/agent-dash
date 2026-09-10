Type: implementation
Status: resolved
Blocked by:
Label: resolved

# People: month-only period, no Sort menu; Spend/Work: "Aggregation" and "Per"

## Goal

`/[org]/people` opens on the current month and offers only calendar months — never "All data",
which does not scale. Team stays a filter, Kind stays as is, and the toolbar's Sort menu goes:
the table headings already show and change the order. On `/[org]/spend` and `/[org]/work`, the
control labelled **Grain** is labelled **Aggregation** and the one labelled **Subject** is
labelled **Per**. URL parameters do not change.

Decided by the human, 2026-09-10. "Kind selector stays" and "the Sort menu is the one that goes"
are the readings taken of the human's words; if the human meant something else, they will say.

## What exists today

- `src/components/controls/schema.ts` — `OFFERS_WHOLE_WINDOW.people = true`; `periodOptions`.
- `src/data/params.ts` — `DECLARED_CONTROLS.people = ["period", "team", "memberKind", "sort"]`;
  `PANEL_LOCAL_CONTROLS`; `toolbarControls` / `panelLocalControls` partition test.
- `src/components/controls/control-renderers.tsx` — labels `Grain`, `Subject`, `Sort`, `Team`,
  `Kind`; `named()` option labels.
- `src/components/controls/active-filters.tsx` — the sentence "Week grain · by Team · …".
- `src/app/[org]/people/page.tsx` — heading sort links via `sortHrefFor` (keep).
- `src/data/queries/context.ts` — `team` already filters rows and population on People.

## Scope

1. `OFFERS_WHOLE_WINDOW.people = false`. Default period on People = the current month (the
   month `now` falls in, in the Organization's timezone). Amend the comment block accordingly.
2. **Sort leaves the toolbar, keeps its URL.** Add `TABLE_CONTROLS = ["sort"]` in `params.ts`
   beside `PANEL_LOCAL_CONTROLS`; `toolbarControls` excludes both. The partition test becomes
   toolbar ∪ panel-local ∪ table = declared. `?sort=` still parses, serialises and is produced
   by the heading links. Remove the `sort` renderer from the toolbar; delete `sortOptions` from
   `controlOptions` if nothing else reads it.
3. **Team reads as a filter.** Keep the control; its default label is "All teams" and the
   active-filter sentence on People says "Platform team" when one is chosen. Verify the table's
   rows and the population narrow (already true; assert it in an e2e on People).
4. **Kind** unchanged.
5. **Labels.** `Grain` → `Aggregation`, `Subject` → `Per` in `control-renderers.tsx`; the
   `Per` menu's options read `Organisation` / `Team` / `Member` (British spelling matches the
   rest of the product copy). Active-filter sentence: "Week aggregation · per Team · …". Update
   `aria-label`s and every test string that spells the old labels (`page-toolbar.test.tsx`,
   `active-filters.test.tsx`, `e2e/controls.spec.ts`, `e2e/reading.spec.ts`).
6. **Spec.** R-C1's People row lists Period (months only), Team, Kind; R-N15 gains "the Sort
   control is the table's headings"; R-C1/R-C6 mention the new names. `canonicalQuery` output is
   byte-identical before and after (assert: T-C14's literal URLs unchanged).

## Done when

- Unit: `periodOptions("people", …)` has no "All data" entry and the first entry is the month of
  `now`.
- Unit: toolbar on People has three groups; `?sort=` round-trips through `canonicalQuery`.
- e2e: People toolbar shows Period, Team, Kind and nothing else; clicking a heading changes
  `?sort=`; Spend toolbar reads Aggregation / Per; URLs after each change are unchanged from
  today's literals.
- All six gates green.

## Comments

**2026-09-10 — built, all six gates green.**

| Gate | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | pass — 1423 tests, 64 files (1421 before; +2 net after the Sort menu's own cases went) |
| `pnpm test:coverage` | pass — statements 98.4%, branches 89.26%, functions 98.99%, lines 99.53% |
| `pnpm build` | pass |
| `PORT=3103 pnpm e2e` | pass — 162 tests (155 before), 1.6 min wall |

**What each scope item became.**

1. `OFFERS_WHOLE_WINDOW.people = false`. The default is unchanged machinery: the first offered
   option is the newest month the window touches, and the clock is clamped to the window's last
   day, so that month is the one `now` falls in. Both comment blocks say so.
2. `TABLE_CONTROLS = ["sort"]` beside `PANEL_LOCAL_CONTROLS`, with `tableControls(page)` and a
   `WidgetControl = Exclude<ControlKey, TableControl>` type. `RENDERERS` and `ControlWidget` are
   keyed on `WidgetControl`, so there is no renderer for `sort` to reach rather than a convention
   not to reach one. The partition test is three-way. `ControlOptions.sortColumns` is gone;
   `PEOPLE_SORT_COLUMNS` stays, because the parser still validates `?sort=` against it.
3. Team keeps its control; its off state reads "All teams" and the sentence reads "Platform team".
4. Kind untouched.
5. `Grain` → `Aggregation`, `Subject` → `Per` (options Member / Team / Organisation, in
   `ROLLUP_LEVELS` order); sentence "Week aggregation · per Organisation · …".
6. `spec.md` R-C1, R-C6, R-C7 and R-N15 amended; `testing-spec.md` T-C6 amended.

**Escalations, cheaper option taken in each case.**

- **"Organisation" against "Organization" elsewhere.** The ticket asks the Per menu to read
  Organisation, on the ground that British spelling matches the product's copy. It does not
  match everywhere: `CONTEXT.md`'s glossary term is **Organization**, and chart titles read
  "grouped by Organization". Rewriting those is a wider change than this ticket, and three of the
  files that spell them belong to tickets in flight. Taken: the ticket's spelling for the control
  and for the active-filter sentence, the existing spelling everywhere else. **Cost:** two
  spellings coexist on `/demo/spend` — the Per strip says Organisation and the chart title above
  it says Organization. One line of copy in a later ticket closes it either way.
- **"All teams" was not expressible.** `filterMenu` derived its off-state option from the
  control's own label — `All ${label.toLowerCase()}` — so it read "All team", "All repository",
  "All kind". Team could not read "All teams" without either a special case or an explicit label.
  Taken: an explicit `all` per filter, which also fixes the five neighbours and makes the menu
  agree with the phrase R-C7's sentence already printed for the same state ("all templates").
  **Cost:** five labels changed that the ticket did not name.
- **Naming.** The ticket calls the field `sortOptions`; it is `sortColumns` in the code. Deleted
  under its real name.

**URL parity.** No parameter, key or serialisation changed. `canonicalQuery` differs only in
which *period* it omits on `/demo/people`, which is scope item 1 itself. Every literal URL in
`panel-control.test.tsx`, `schema.test.ts` and `e2e/controls.spec.ts` is unchanged and green, and
the relabelling test clicks Aggregation and Per and asserts `?grain=month` and `?subject=team`.
