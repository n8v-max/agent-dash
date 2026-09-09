Type: implementation
Status: resolved
Blocked by: 45
Label: resolved

# `docs/ingest.md` — where sessions come from

## Scope

One page with one diagram (Mermaid). Platform emits a session-ended event; billing attributes
cost (ADR-0005); an ingest worker upserts by session id (idempotent); a nightly job rebuilds the
pre-aggregates. State the latency budget from session end to dashboard, the as-of timestamp
(ticket 45) as the observable, and what a late or duplicate event does. Three failure modes:
billing lag, mid-month rate change, a session with no tracker key. For each, what the dashboard
shows.

## Done when

File exists, linked from README and from ADR-0009.

## Comments

### 2026-09-09 — implemented (AFK wave 3, worktree `agent-dash-t55`)

`docs/ingest.md`, one page, one Mermaid flowchart. Four gates green: `lint` clean · `typecheck`
clean · `test` **1379** across 63 files · `build` clean. `test:coverage` and `e2e` were skipped
under the wave rule — the diff holds no file under `src/` or `e2e/`, only `docs/ingest.md` and this
ticket.

**The Mermaid diagram was parsed, not eyeballed.** `mermaid@11.17.2` + `jsdom` installed in `/tmp`
(outside the worktree, nothing added to `package.json`), `mermaid.parse()` run over the fenced block
extracted from the file: `OK (flowchart-v2)`. The checker was verified to discriminate — a
deliberately malformed block fails it with a parse error and exit 1.

**Where each claim comes from.**

- Four steps: this ticket's Scope. Cost attributed upstream and the app pricing nothing —
  ADR-0005 and `CONTEXT.md` § Models & Money. Nightly pre-aggregate rebuild at
  (day × member × repo × work_type × model) — ticket 54's scope, linked as `docs/adr/0009-scale.md`
  and **not read, created or edited** (it does not exist on this branch).
- Events are emitted at session *end* because every session measure is observable at session end —
  `CONTEXT.md` § Session measures, which is also why a session row is immutable and why a duplicate
  upsert is a no-op rather than a merge.
- The as-of stamp: `src/domain/observation.ts` (selects greatest `ended_at`, ties by id ascending,
  instants compared as numbers), `dataAsOf()` in `src/data/clock.ts` (prints that session's
  `started_at` in the Organization timezone; carries `observedTo` and `sessionId`), R-N3.1, and
  ticket 45's recorded escalation. **The document describes what the code does, including the
  divergence**: the printed stamp understates the true watermark by one session's duration, and the
  document draws the ingest consequence — alerting fires on `observedTo`, never on the label.
- `loadDataset().sessions` holds **roots** with children folded in (R-M19, `src/data/load.ts`), so
  the dataset's edge is always a root: a child ends inside its root's window (ADR-0008).
- Late child: the roll-up is recomputed from raw, never incremented, so the rebuild is idempotent;
  the child dirties the partition of **its root's start day**, so the rebuild window must be at
  least *longest session + billing lag* wide. `/demo/history` reads child rows and the five
  aggregate surfaces do not (ADR-0008), which is what makes the disagreement between them the
  observable.
- Failure modes: period-stable rate cards and the usage/price ambiguity — `CONTEXT.md` § Rate card;
  "a stored cost can disagree with the displayed card" — ADR-0005 § Consequences; the platform
  refusing to launch without a tracker key, and Rework being why Task and AgentSession are distinct
  — `CONTEXT.md` § Work; the partial-period flag's actual scope — R-E2; the existing
  strip-at-the-boundary precedent — R-M2 in `src/data/load.ts`; freshness alerting — `docs/roadmap.md`.

**No spec identifier was allocated.** The document cites existing ones (R-N3.1, R-M2, R-M11, R-M19,
R-E2, R-D2, R-T19) and introduces none, so there is nothing here to collide with a parallel wave.
Nothing under `src/` was touched, and no spec file was edited.

**Escalated decisions, both taken as the cheaper option and recorded rather than asked.**

1. **An unpriced session is held upstream of ingest rather than admitted with a null cost.** The
   schema carries `cost: number` with no null, and ADR-0005 forbids the application deriving one, so
   an admitted-but-unpriced row would force every money aggregate either to drop it (a silent
   undercount) or to read it as zero (a stated wrong figure). Holding keeps the invariant that
   everything behind the as-of stamp is complete, and makes the stamp itself the billing-lag
   observable. **Cost:** ingest cannot distinguish a session billing has not priced *yet* from one it
   will never price — recorded under the document's `## Open`.
2. **The root event carries its fan-out size, so an attempt is admitted whole.** This is one field
   asked of the platform, and the platform already has to state it: *Agents per session*, median and
   p95, is a panel figure under ADR-0008. The alternative — admit the root when priced and let the
   nightly rebuild heal the roll-up — was rejected as the default because it lets the stamp advance
   past an attempt whose cost is understated. The late-child case is still described in full, since
   a correction or a re-price can arrive after admission regardless.
3. **A mid-window rate change is left unrepresentable, and the gap is stated rather than specified
   away.** Fixing it means an effective-from on the rate card plus a flag on any window spanning a
   change — a spec change (R-E2's mechanism reused), not a document. Written up under `## Open`;
   no spec rule was invented here.

**Inbound links are owed by two other tickets and are not discharged here.** The Done-when says
"linked from README and from ADR-0009"; this document links *outward* to both by path.

- **Ticket 49 (README)** — add `docs/ingest.md` to its § 7 links list. The README does not exist yet
  and is not this wave's to write.
- **Ticket 54 (ADR-0009)** — the ADR should link `docs/ingest.md` where it names the nightly
  pre-aggregation job, which is the same job step 4 of this document describes. A sibling agent owns
  that file this wave; it was not read, created or edited from here.

Until both land, `docs/ingest.md` is reachable only by path. That is the only part of this ticket's
Done-when left open.
