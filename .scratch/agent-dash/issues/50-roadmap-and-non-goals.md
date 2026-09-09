Type: implementation
Status: resolved
Blocked by: 48
Label: resolved

# `docs/roadmap.md` — next three releases and the recorded cuts

## Scope

- **Next**: BYOK split of Total spend (ticket 57), agent identity and version as a dimension,
  tool and MCP call counts per session.
- **Then**: recommendation per WorkType (move this work to a cheaper tier, rework risk stated),
  export CSV, as-of freshness alerting.
- **Later**: budgets and enforcement, once the numbers have earned trust.
- **Cuts with reasons**, one line each: quality signals, empty state, token normalisation,
  role authoring, real OAuth, seat cost visible to the restricted account (accepted leak,
  human decision 2026-09-09).

Under 80 lines. Link from README.

## Comments

### 2026-09-09 — written (AFK build, wave 6, worktree `agent-dash-t50`)

`docs/roadmap.md`, **79 lines**, four sections exactly as scoped: **Next**, **Then**, **Later**,
**Cuts, with reasons**. Gates: `lint` · `typecheck` · `test` · `build` green. `test:coverage` and
`e2e` skipped under the wave rule — the diff touches nothing under `src/` or `e2e/`.

**The document argues the sequence rather than listing features.** Its opening claim is that the
ordering *is* the argument: the product's claim is Cost per completed Task, a ratio over an
attributed figure the application does not compute (ADR-0005) against a rate model that estimates
an invoice rather than reproducing one (`CONTEXT.md` § Token class). Next completes that figure,
Then acts on it, and enforcement waits for Later because a limit is only as defensible as the
number it fires on. Each of the three Later bullets is a reason for the *position in the queue*,
not a description of a feature.

**Where each entry's reasoning came from — compressed, not invented.**

| Entry | Source compressed |
|---|---|
| BYOK | ticket 57's scope; links `docs/adr/0010-byok.md` by path, unread and untouched (sibling agent owns it) |
| Agent identity and version | ADR-0008 § Consequences — the fan-out is legible in *size* (Agents per session) and not in *composition* |
| Tool and MCP calls | `CONTEXT.md` § Session measures (`prompt_count` is deliberately the only interaction-volume measure) + brief 15's `mcp_server.name` / `mcp_tool.name` precedent, against ticket 02 having found none |
| Recommendation per WorkType | R-M6 (no Organization-level acceptance rate) + ADR-0007 (the 200× spread) + `CONTEXT.md` Rework rate |
| CSV export | ADR-0006 — the ViewModel seam is why the rows already exist one layer down |
| As-of freshness alerting | R-N3.1 (the stamp already ships on every surface) |
| Later: budgets and enforcement | `spec.md` § 1.1 ("not a control plane; projection in, limits out"), ticket 13's collapsed rate-card key, ADR-0003's KiroRank / Microsoft-division record |
| Quality signals | `spec.md` § 1.1 + `CONTEXT.md` § Work (the platform does not own the Task's lifecycle) |
| Zero-data state | ticket 11 § Closed — `wontfix`, with its stated cost |
| Token normalisation | ticket 13 § Closed — `wontfix`, "multi-vendor by assertion rather than by demonstration" is that ticket's own phrase |
| Role authoring | `spec.md` § 1.1, updated for § 11 C9 — the matrix no longer renders at all, so there is no surface to author from |
| Real OAuth | `spec.md` § 1.1 |
| Seat cost leak | `handover-afk-wave-2.md` § Decisions already taken, 2026-09-09 |

**The seat-cost entry is recorded as a leak, not softened into a feature.** The mechanism is
stated: the seat fee is flat and period-stable (R-M5), so a restricted account reading its own
Total spend split learns the Organization's *per-seat price* — a `cost` fact about every human
Member, not only about itself — and times any headcount it can reach, that is somebody else's seat
bill. The acceptance is given two reasons, both sourced: seat cost is ~46% of Total spend after
ADR-0008 and a total without it is the wrong number, and suppressing the split would make the
restricted view a *different page* rather than the same page with fewer rows (R-A5, R-A8). It
closes on the same weaker-and-true claim ADR-0003 makes about subtraction — the product does not
*display* a figure outside a grant, and never claimed the figure was unrecoverable.

#### Decisions taken under the escalation rule

**No README link was written, and none is owed.** The ticket says "Link from README"; no README
exists — ticket 49 writes it last and is blocked on everything. Ticket 49 § Scope item 7 already
lists `docs/roadmap.md` under Links, so the dependency is already discharged on that side and
editing 49 would have added nothing. **The cheaper option, and its cost:** `docs/roadmap.md` is
currently unlinked from anywhere. If ticket 49 is ever cut, the roadmap is reachable only by
knowing the path. Ticket 49 owns the fix; this ticket owns nothing further.

**No new reasoning was authored for any cut.** Where a source's wording had drifted — the role
authoring cut in `spec.md` § 1.1 still reads "the matrix renders read-only", which § 11 C9
withdrew — the roadmap states the *current* position and names C9, rather than repeating a line
the spec has since overtaken. No spec was edited.
