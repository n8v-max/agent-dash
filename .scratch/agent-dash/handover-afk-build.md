# Handover: the unattended build

Written 2026-09-07 by the session that checked AFK readiness. **The human is away.** Work the
implementation tickets in wave order, unattended, and stop only on a condition listed in § 8.

---

## 1. Where the project is

The wayfinder map is **closed**. `spec.md`, `technical-spec.md` and `testing-spec.md` are written
and carry no open questions. 22 implementation tickets (17–38) exist under `issues/`, all
`ready-for-agent` except **37**, which is human-owned.

`src/` still holds only the Next scaffold: `app/page.tsx`, `layout.tsx`, `globals.css`, one smoke
test, one Playwright smoke spec. **No product code exists yet.** Ticket 17 is the first real work.

**Read before touching anything**, in this order: `CONTEXT.md` (the domain model is
two-dimensional and non-obvious), `docs/adr/`, then the three specs. `AGENTS.md` also requires
reading the relevant guide under `node_modules/next/dist/docs/` before writing Next code — this is
Next 16, not the Next in your training data. **Ignore `.scratch/_archive/`**: superseded, and its
tickets contain agent-written answers.

## 2. Environment facts you would otherwise rediscover the hard way

- **Node is fnm-managed and was invisible to non-interactive shells.** Fixed on 2026-09-07 by
  symlinking `node`, `npm`, `npx` from fnm's `default` alias into `~/.local/bin` (already first on
  PATH). `node -v` → v24.20.0 in a fresh shell. If that ever breaks, every gate fails with
  `exec: node: not found` — that is the symptom, and the symlinks are the fix.
- pnpm 12.3.4 · Node 24.20.0 · Next 16.3.4 on Turbopack · React 19.2.8 · Recharts pinned by ticket 17.
- **`AUTH_JWT_SECRET`** is the session signing key (R-T14). Provisioned in `.env.local` for dev and
  as a fixed literal in CI. **Production is a human step** — `scripts/setup-vercel.sh` stage 5.
  Do not invent a second name for this variable.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm build`, `pnpm e2e`.
- Commits go **straight to `main`** — that is this repo's history, there is no PR flow. Message
  style: lowercase `type:` prefix, prose body explaining the *why*, `Co-Authored-By: Claude Opus 5
  <noreply@anthropic.com>` trailer. The Next.js block in `AGENTS.md` is re-added by `next dev`;
  commit it with your work rather than reverting it.

## 3. Step 0 — amend ticket 17 before implementing it

These were found by reviewing `eslint.config.mjs` against the specs and are **not yet applied**.
Fold them into ticket 17's scope, then implement it.

1. **The existing layering rules target `src/lib/**`, which the specs never mention** and which
   will never exist. `agent-dash/layering` and `agent-dash/computation-layer-is-framework-free`
   currently match zero files and pass silently. **Retarget both to `src/domain/**`** and add
   `src/data` in the correct direction. This is a defect in committed code, not a plan change.
2. **Guard the seam in both directions.** R-T33 stops `src/domain` importing React; nothing stops
   `src/components/panels/*` importing `@/domain/aggregate` — the failure ticket 28 calls "the
   weaker version". Use `@typescript-eslint/no-restricted-imports` with `allowTypeImports: true`
   so components may import ViewModel *types* only, and `src/data/queries.ts` is the sole runtime
   path into the domain. Needs type-aware linting (`projectService`). **If enabling it costs more
   than ~30s on `pnpm lint`, keep the rule and record the cost in the ticket — do not drop it.**
3. **Ban nondeterminism in the domain by global, not by import.** `Date.now()`, `new Date()`,
   `Math.random()`, `process.env` are globals, so `no-restricted-imports` cannot see them. Use
   `no-restricted-globals` plus `no-restricted-syntax` for `NewExpression[callee.name="Date"]`.
4. **Localise fixture I/O.** `resolveJsonModule` is on, so any module can import fixture JSON
   directly and bypass `src/data/load.ts` with its schema validation. Restrict `*.json` imports and
   `node:fs` to `src/data/**` and `src/fixtures/**`.
5. **Close the cheap paths to green** — the rules that matter most while nobody is watching.
   `vitest/no-disabled-tests` is currently **`warn`**: a skipped test keeps CI green. Raise it to
   error, and add `@eslint-community/eslint-plugin-eslint-comments`
   (`no-unlimited-disable`, `require-description`), `@typescript-eslint/ban-ts-comment` and
   `no-explicit-any`, at minimum across `src/domain/**` and all test files.
6. **`perFile: true`** on R-T34's 95/90 domain coverage threshold, so a well-covered module cannot
   carry an untested one.
7. **`react/no-array-index-key` as an error** (R-T8). This is the T-C3 legend bug class, caught at
   lint time in every module rather than by one component test.

**Do not** add a blanket `no stackId` lint rule — `testing-spec.md` argues against it explicitly
(it would forbid two legitimate part-to-whole panels). T-C11's table-driven assertion is correct.

## 4. Wave plan

Derived from the `Blocked by` edges. A wave opens only when every ticket in the previous wave is
**merged into `main` and green**.

| Wave | Tickets | Parallel? |
|---|---|---|
| 0 | **17** scaffold + boundaries | No — everything depends on it |
| 1 | **18** roll-up spike · **19** fixture generator | Serial is fine (shallow) |
| 2 | **20** data-load boundary | No |
| 3 | **21** access model · **22** periods | Serial is fine |
| 4 | **23** aggregation · **27** change/series · **29** auth | Serial is fine |
| 5 | **24** spend · **25** efficacy · **26** adoption | **Yes — fan out** |
| 6 | **28** query facade | No — the load-bearing seam |
| 7 | **30** shell + controls | No |
| 8 | **31** chart frame | No |
| 9 | **32** summary · **33** spend · **34** work · **35** people · **36** history | **Yes — fan out** |
| 10 | **38** e2e + gates | No |

**Fan out on waves 5 and 9 only.** Both are file-disjoint (one domain module each; one route each),
and wave 9 is safe *specifically because* ticket 28's Done-when requires every panel query to
exist before it opens. If 28 landed incomplete, wave 9 is not parallel — five agents editing
`queries.ts` is the one genuinely bad conflict in this plan. Check that first.

Waves 1, 3 and 4 are technically parallel but 2–3 shallow tickets each; the worktree overhead
outweighs the gain.

**Ticket 37 is the human's** and blocks nothing (38 depends on 32–36, not 37). Leave it.

## 5. Worktree protocol

```sh
# one per ticket in a fanned-out wave, all branched from the same base commit
git worktree add ../agent-dash-t24 -b ticket/24-metrics-spend main
cd ../agent-dash-t24
cp ../agent-dash/.env.local .        # gitignored — a worktree does NOT inherit it
pnpm install                          # a worktree does NOT inherit node_modules
```

Three gotchas, each of which produces a *green* run that means nothing:

- **`.env.local` is gitignored**, so a fresh worktree has no `AUTH_JWT_SECRET` and auth work fails
  in a way that looks like a code bug. Copy it.
- **`node_modules` is not shared.** Install per worktree.
- **Playwright: `reuseExistingServer` is `true` locally and the port defaults to 3000.** Two
  worktrees running `pnpm e2e` at once means the second silently tests *the first worktree's app*
  and passes. Give every worktree its own port: `PORT=3101 pnpm e2e`, 3102, 3103…

Merging a wave: merge branches into `main` **one at a time**, `--no-ff`, running the full gate set
on `main` after each. Conflicts will be almost entirely `Status:` lines in ticket files — trivial,
but resolve by intent, and reach for `/resolving-merge-conflicts` on anything that is not. Then
`git worktree remove ../agent-dash-tNN` and push `main`.

## 6. The per-ticket loop

`/implement` once per ticket, **`/clear` between each** — every ticket is self-contained, so the
previous one's context is disposable. `/implement` drives `/tdd` internally and closes with
`/code-review` before committing; let it.

Four detours:

- **Ticket 18 → `/prototype`.** It is typed `implementation` but is explicitly throwaway and runs
  before any panel. Keep it on a `prototype/*` branch as a primary source, pointed at from 31.
- **Ticket 28 → `/codebase-design` first.** Its own notes call it "the highest-leverage structural
  decision in the project". Spend the extra pass here and nowhere else.
- **Anything red → `/diagnosing-bugs`**, which insists on a failing command before any theorising.
- **Wave merges → `/code-review`** against the wave's base commit, on top of the per-ticket review.

**Do not `/triage` these tickets** — they came from `/to-tickets` and are already agent-ready.

## 7. Optional, only if the run outpaces the plan

`technical-spec.md` § 3.1 already specifies the ViewModel shape, and `src/domain/types.ts` is
created by ticket 17. Landing the ViewModel type and the `(viewer, params)` query signatures early
would let the UI lane (29→30→31→32-36) run concurrently with the data lane
(19→20→21/22→23→24-27→28), roughly halving the 11-deep critical path. **This is a design decision,
not an AFK task**: it means panels built against stub data and re-verified later. Raise it with the
human; do not do it unattended.

## 8. Stop conditions — leave it red and write it down

Stop the ticket, leave the branch unmerged, record what you found in the ticket file, and move to
the next unblocked ticket:

- **Green would require disabling a rule**, adding `eslint-disable` / `@ts-expect-error` / `as any`,
  or skipping a test. Never buy green this way. The gates are the point.
- **The code and a spec disagree.** The specs are the fixed point. Never edit a spec to match code.
- **A ticket's premise looks wrong.** Record the argument; do not re-decide it.
- **Any HITL question.** The standing preference on this map is that the human answers them, and
  map v1 was archived for exactly the failure of pre-answering. This covers ticket 37 absolutely.

Three specific traps the tickets call out, worth repeating because each is an easy "improvement":

- **Do not add sessions to the fixture** (19). ~750 is deliberate; volume would bury seat cost.
- **Do not filter the ~2% hidden sessions out of the fixture** (20). They exist so the exclusion
  rule has something to act on.
- **Do not weaken T-E4 to a DOM query** (29, 38). Payload inspection is the only thing proving the
  access model acts on the wire rather than in a function.

## 9. Report back

Leave a summary at the end covering: which tickets merged, which are red and why, ticket 18's
finding, anything from § 8 that stopped a ticket, and whether the wave-9 parallel assumption held.
Ticket 37 and the Vercel `AUTH_JWT_SECRET` stage are waiting for the human either way.
