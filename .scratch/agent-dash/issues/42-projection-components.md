Type: implementation
Status: resolved
Blocked by:
Label: resolved

# `/demo/projection` — show the two components

## Goal

Spend to date includes the seat fee. Only session cost is extrapolated. A reader cannot verify the
projected figure from what is on screen.

## Scope

- Both tiles show a two-line breakdown under the headline: session cost and seat cost.
- The projected tile shows "session cost × (30 / 8) + seat cost" with the real numbers.
- Chart: add the seat cost as a flat reference line or a note; do not stack it into days (R-M5).
- The method text shrinks to one sentence; the arithmetic replaces the prose.

## Done when

- Unit: projection ViewModel carries `session_to_date`, `seat`, `projected_session`, `projected_total`
  and the identity `projected_total === projected_session + seat` holds.
- e2e: the four numbers are on the page and sum.

## Notes

Decided by the human, 2026-09-09, round 1 (P1 item 7).

## Comments

### 2026-09-09 — implemented (AFK wave 2, worktree `agent-dash-t42`)

**What was wrong.** Both tiles printed a total and nothing else, and the two totals are not the
same sum: spend to date is session Cost **plus a whole month's seat charge**, and only the session
part is extrapolated (R-M5, R-D2). A reader given `$1,099.58` and `$2,192.93` could not check
either figure, and the method paragraph explained the arithmetic in prose instead of doing it.

**The ViewModel now carries the components as components.** `ProjectionPageViewModel.components`
holds `sessionToDate`, `seat`, `projectedSession` and `projectedTotal`, and **`projectedTotal` is
assigned as `projectedSession + seat`** — so the identity is a property of the construction, not
an agreement between two independently summed figures, and `T-U21.1` asserts it as a strict
equality with no tolerance. Both projected fields are `null` together: a projected total that was
only the seat charge would read as a forecast of a month nobody has spent anything in.

This **replaced** `actual` / `projected` (the old `ProjectionFigures` pair) rather than sitting
beside them. Three shapes for four numbers is what makes a figure unverifiable in the first place,
and the two old fields had no reader outside this page.

**On screen** (`/demo/projection`, open account, committed fixture):

| | |
|---|---|
| Spend to date | `$1,099.58` — Session cost `$397.58`, Seat cost `$702.00` |
| Projected month-end spend | `$2,192.93` — Session cost `$1,490.93`, Seat cost `$702.00` |
| The arithmetic | `$397.58 × (30 ÷ 8) + $702.00 = $2,192.93` |

The seat line is the **same figure in both tiles**, which is the whole point of showing it twice:
it is the one component that is not projected. The method text is R-N23's one sentence and the
two-sentence seat paragraph under it is gone — the arithmetic says what it said.

**The chart got a note, not a reference line.** Both were permitted by the ticket; the note is the
cheaper option and here it is also the better one. A `$702` reference line drawn over daily bars
that top out in the single dollars flattens the series it was drawn on to a baseline, and it would
have meant changing `chart-frame.tsx` / `chart-shapes.tsx` — shared files, mid-wave. The daily
series stays session Cost alone (`T-U21.1` asserts one series, `stackable: false`, and a two-column
mirror), and the flat monthly figure is stated underneath it. **Nothing is stacked into days.**

**Naming.** The ticket names the fields `session_to_date` / `seat` / `projected_session` /
`projected_total`; they ship camelCased, because snake_case in this codebase means *fixture or
payload key* (`execution_mode`, `accepted_at`) and these are ViewModel properties. Same four
figures, same identity, house spelling.

**Spec amendments in this commit:** `spec.md` gains **R-N23.1** (both figures broken into their
components, the arithmetic printed, the seat charge beside the chart and never in it);
`testing-spec.md` gains **T-U21.1** (the ViewModel identity, at the seam — the extrapolation
itself stays T-U21's in the domain layer), **T-C12** (the tiles print their components; R-N24's
"one figure, no bound" claim restated over the new layout rather than dropped) and **T-E10** (the
four numbers are on the page and sum).

**Deliberately not done.** `src/domain/metrics/projection.ts` is untouched — ticket 40 owns the
no-day-elapsed case there, and the composition this ticket needed belongs at the seam where the
seat charge is known. The local `money` formatter in `projection-panel.tsx` is also untouched:
ticket 41 owns collapsing the copies into `figures.ts`.

**Gates:** `lint` clean · `typecheck` clean · `test` 1,110 across 52 files · `test:coverage`
97.96% statements / 87.35% branches, every per-file domain threshold met · `build` clean, all six
routes as before · `PORT=3104 pnpm e2e` **103 passed**.
