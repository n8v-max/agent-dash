Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

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
