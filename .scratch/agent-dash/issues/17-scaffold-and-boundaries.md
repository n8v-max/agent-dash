Type: implementation
Status: resolved
Blocked by: —
Label: resolved

# Scaffold the UI stack and lock the architectural boundary

**Runs first.** Every other ticket depends on the versions this one pins and the lint rule it
installs.

## Goal

shadcn/ui + Tailwind 4 scaffolded onto the existing Next 16.3.4 app, with Recharts 3 verifiably
resolved, and the `src/domain/**` purity boundary enforced by lint rather than by discipline.

## Scope

- `shadcn init` scaffolded from a **`v4` or `base-*` style** — hard requirement (R-T2). The legacy
  `default` / `new-york` styles pin `recharts@2.15.4`, npm-marked **deprecated**: the same dead 2.x
  branch that disqualified Tremor in ticket 04. Landing there silently reverses ticket 14.
- **Run it non-interactively.** The CLI prompts otherwise, and an unattended run hangs on the
  prompt rather than failing:

  ```sh
  pnpm dlx shadcn@4.21.0 init --preset base-nova --no-monorepo --yes --force
  ```

  Flags verified against shadcn **4.21.0** on 2026-09-07. `--preset base-nova` is the CLI's own
  default preset and satisfies R-T2's `base-*` requirement; `--no-monorepo` and `--yes` suppress
  the two prompts; `--force` lets it overwrite the config it finds in an already-scaffolded app.
  The 4.x CLI has **no `--style` flag at all**, so the deprecated `default` / `new-york` styles
  cannot be reached through it — but the pinned CLI version is the only thing holding that true,
  which is why the check below still runs. If it prompts anyway, that is a defect in these flags:
  do not answer it, re-run with `--defaults` (which resolves to `--template=next
  --preset=base-nova`) and record what changed.
- Verify `components.json` and the **resolved** recharts version immediately after init. **Pin
  recharts exactly** (R-T3) — `package.json` currently has `"recharts": "^3.10.1"`, and the caret
  lets a transitive bump cross the 2.x/3.x boundary unobserved. Change it to `"3.10.1"`.
- No React 19 override and no `--legacy-peer-deps`. shadcn's React 19 page still advises them; that
  advice is stale, written for 2.x. Recharts 3.x declares `react: ^19.0.0` as a real peer.
- Confirm Turbopack is in use (R-T1). Both open Next × Recharts 3 blockers are webpack-specific.
- Add the ESLint `no-restricted-imports` override for `src/domain/**` (R-T33), forbidding `react`,
  `next`, `next/*`, `node:fs`, and relative escapes into `../data`, `../app`, `../components`.
- Add the `src/domain/**` coverage threshold override: 95% statements / 90% branches (R-T34, T-Q2).
- Create the directory skeleton from `technical-spec.md` § 2.

## Scope amendment — lint boundary defects (added 2026-09-07, AFK build step 0)

Found by reviewing `eslint.config.mjs` against the specs. Items 1–4 are defects in committed
code, not plan changes: the boundary rules the config claims to enforce currently match zero
files and pass silently.

1. **Retarget the layering rules from `src/lib/**` to `src/domain/**`.** `agent-dash/layering`
   and `agent-dash/computation-layer-is-framework-free` both target `src/lib`, which the specs
   never mention and which will never exist (`technical-spec.md` § 2 names `src/domain`). Both
   rules currently match nothing. Retarget both, and add `src/data` to the forbidden `from` set
   in the correct direction — `src/domain` may not import `src/data`, per R-T5.

2. **Guard the seam in both directions.** R-T33 stops `src/domain` importing React. Nothing
   stops `src/components/panels/*` importing `@/domain/aggregate` — which is precisely "the
   weaker version" `technical-spec.md` § 3.1 rejects and ticket 28 inherits. Add
   `@typescript-eslint/no-restricted-imports` on `src/components/**` and `src/app/**` with
   `allowTypeImports: true`, so components may import ViewModel *types* only and
   `src/data/queries.ts` is the sole runtime path into the domain. Needs type-aware linting
   (`projectService`). **If enabling type-aware linting costs more than ~30s on `pnpm lint`,
   keep the rule and record the measured cost in this ticket — do not drop it.**

3. **Ban nondeterminism in the domain by global, not by import** (P5, R-T5). `Date.now()`,
   `new Date()`, `Math.random()` and `process.env` are globals, so `no-restricted-imports`
   cannot see them. Use `no-restricted-globals` plus `no-restricted-syntax` matching
   `NewExpression[callee.name="Date"]` and `CallExpression[callee.object.name="Date"]`.

4. **Localise fixture I/O.** `resolveJsonModule` is on, so any module can import fixture JSON
   directly and bypass `src/data/load.ts` with its schema validation (R-T19, boundary 1).
   Restrict `*.json` imports and `node:fs` to `src/data/**` and `src/fixtures/**`.

5. **Close the cheap paths to green** — the rules that matter most on an unattended build.
   `vitest/no-disabled-tests` is currently **`warn`**, so a skipped test keeps CI green; raise
   it to `error`. Add `@eslint-community/eslint-plugin-eslint-comments`
   (`no-unlimited-disable`, `require-description`), plus
   `@typescript-eslint/ban-ts-comment` and `@typescript-eslint/no-explicit-any`, at minimum
   across `src/domain/**` and all test files.

6. **`perFile: true` on the R-T34 / T-Q2 domain coverage threshold**, so a well-covered module
   cannot carry an untested one under a directory average.

7. **`react/no-array-index-key` as an error** (R-T8). This is the T-C3 legend bug class, caught
   at lint time in every module rather than by one component test.

**Explicitly not in scope:** a blanket "no `stackId`" lint rule. `testing-spec.md` T-C11 argues
against it directly — it would forbid the two legitimate part-to-whole panels (R-N8's WorkType
tile and R-N12's duration spans). T-C11's table-driven assertion is the correct mechanism.

## Done when (amendment)

- `agent-dash/layering` and `agent-dash/computation-layer-is-framework-free` target
  `src/domain/**`; neither mentions `src/lib`.
- A deliberate runtime `import { aggregate } from "@/domain/aggregate"` in
  `src/components/` fails `pnpm lint`; a `import type { ChartViewModel }` from the same place
  passes.
- A deliberate `new Date()` or `Math.random()` inside `src/domain/` fails `pnpm lint`.
- A deliberate fixture JSON import from `src/components/` fails `pnpm lint`.
- `vitest/no-disabled-tests` is `error`.
- The `src/domain/**` coverage threshold carries `perFile: true`.
- `pnpm lint` wall-clock cost is recorded below.

## Done when

- `components.json` records a `base-*` preset, and no `style` field naming `default` or
  `new-york`.
- `pnpm why recharts` shows a single 3.x entry.
- A deliberate `import { useState } from 'react'` inside `src/domain/` fails `pnpm lint`.
- `pnpm lint && pnpm typecheck && pnpm test` pass.

## Notes

Ticket 14 is explicit that the scaffold style is a **setup-time constraint, not an encounterable
defect** — there is no later moment at which it is discovered. Getting it wrong here is silent.

## Comments

### 2026-09-07 — implemented (AFK build, wave 0)

All six gates green: `lint` · `typecheck` · `test` · `test:coverage` · `build` · `e2e`.
`next build` prints `▲ Next.js 16.3.4 (Turbopack)`, so R-T1 holds without configuration.

**`--preset base-nova` does not exist on shadcn 4.21.0.** The CLI rejects it:
`Invalid preset: base-nova. Available presets: nova, vega, maia, lyra, mira, luma, sera, rhea`.
4.21.0 splits the name across two flags — `-b, --base <base>` (`base` | `radix` | `aria`) and
`-p, --preset <name>`. The ticket's flag came from the CLI's own `--defaults` help text, which
still advertises `--template=next --preset=base-nova` and is stale relative to the validator.
The invocation that works, and the one that ran:

```sh
pnpm dlx shadcn@4.21.0 init --base base --preset nova --no-monorepo --yes --force
```

R-T2 is satisfied and the landing is the intended one: `components.json` records
`"style": "base-nova"` — the composite name survives in the config even though it is no longer a
single flag. `pnpm why recharts` shows exactly one entry, `recharts@3.10.1`; no `2.15.4` anywhere.
`package.json` now pins `"recharts": "3.10.1"` exactly (R-T3). No React 19 override and no
`--legacy-peer-deps` were needed.

**`src/lib` does exist after all.** Amendment item 1 said it "will never exist"; `shadcn init`
creates `src/lib/utils.ts` (the `cn` re-export) and `components.json` aliases `@/lib` to it.
The retargeting is still right — the *computation layer* is `src/domain`, and `src/lib/utils.ts`
is a Tailwind class-merge helper for the rendering layer — but the rules were guarding a
directory that now holds something, rather than nothing, so the mis-target mattered more than
the amendment assumed. `src/lib/utils.ts` is excluded from coverage as vendored glue.

**Amendment item 2 needs no type-aware linting.** `@typescript-eslint/no-restricted-imports`
implements `allowTypeImports` syntactically, off `importKind` on the import node; it does not
consult the type service. No `projectService` was enabled and none is needed. The ~30s budget
the amendment set aside is unspent: **`pnpm lint` runs in 1.5s wall-clock**, unchanged from
before this ticket.

**Amendment item 3 was narrowed, deliberately.** It asked for `NewExpression[callee.name="Date"]`.
Banning every `new Date` would make `domain/periods.ts` unwritable — R-M10 bucketing is built on
`new Date(row.started_at)`, which is deterministic. The rule as written would have forced an
`eslint-disable` into the first domain module anyone wrote, which is a § 8 stop condition, not a
gate. The selector therefore carries an arity guard, `[arguments.length=0]`, so the zero-argument
form that reads the wall clock is banned and parsing an ISO string is not. `Date.now()`,
`Math.random()` and `process.env` are banned outright, as asked. This preserves the amendment's
stated purpose — ban nondeterminism — rather than its literal selector.

**Amendment item 6 is not expressible as written.** Vitest 4.1.11 types a glob threshold group
as `Pick<Thresholds, 100 | "statements" | "functions" | "branches" | "lines">` — `perFile` is
absent. It exists only as a single top-level flag, and `checkThresholds` applies that one flag to
**every** group including the global one. Setting it would have made the global 80/75/80/80
per-file, contradicting T-Q1 ("global thresholds stay as committed") and testing-spec § 10, which
plans for thin component coverage carried by the domain layer — per-file 80% would fail each of
those components on its own. Implemented instead as **one generated threshold key per domain
module**, rebuilt from `readdirSync` on every run: vitest evaluates each glob key as its own
coverage map, so a group holding one file *is* per-file. Verified — a domain module with one of
two functions tested reports:

```
ERROR: Coverage for statements (75%) does not meet "src/domain/**" threshold (95%)
ERROR: Coverage for statements (75%) does not meet "src/domain/__probeCov.ts" threshold (95%)
```

**A rule-clobbering defect was found and fixed during verification.** The new fixture-I/O block
(item 4) and the domain block (item 1) both set `no-restricted-imports`, and both matched
`src/domain/**`. Flat config *replaces* a rule's options rather than merging them, so the later
block silently dropped the entire domain boundary — `import { useState } from "react"` inside
`src/domain` passed lint. The rule still reported, just not the things it was added for, which is
the same silent-pass class the amendment exists to close. Fixed by excluding `src/domain/**` from
the fixture block and folding the JSON/`node:fs` restrictions into the domain block's own lists.
This is why every rule below was verified by probe rather than by reading the config.

**Every boundary rule was verified with a deliberate violation**, then the probes were deleted:

| Probe | Expected | Result |
|---|---|---|
| `import { useState } from "react"` in `src/domain` | fail | ✅ `no-restricted-imports` |
| `import { load } from "@/data/load"` in `src/domain` | fail | ✅ `no-restricted-imports` |
| `import { load } from "../data/load"` in `src/domain` | fail | ✅ `no-restricted-imports` |
| `import type { Metadata } from "next"` in `src/domain` | fail | ✅ `no-restricted-imports` |
| `new Date()` · `Date.now()` · `Math.random()` · `process.env` in `src/domain` | fail | ✅ `no-restricted-syntax` + `no-restricted-globals` |
| `new Date(iso)` in `src/domain` | **pass** | ✅ silent |
| runtime `import { aggregate } from "@/domain/aggregate"` in `src/components` | fail | ✅ `@typescript-eslint/no-restricted-imports` |
| `import type { ChartViewModel } from "@/domain/types"` in `src/components` | **pass** | ✅ silent |
| `import rows from "@/fixtures/data/members.json"` in `src/components` | fail | ✅ `no-restricted-imports` |
| `key={i}` in a `src/components` `.map()` | fail | ✅ `react/no-array-index-key` |
| bare `/* eslint-disable */` and an undescribed disable | fail | ✅ `no-unlimited-disable`, `require-description`, `disable-enable-pair` |

`vitest/no-disabled-tests` is now `error`. `@typescript-eslint/no-explicit-any` and
`ban-ts-comment` are `error` across `src/domain/**`, all unit tests and `e2e/**`.
`src/components/ui/**` is globally ignored — shadcn primitives are vendored, not authored here.

The directory skeleton from `technical-spec.md` § 2 is created with `.gitkeep` files; the
`src/domain/metrics`, `src/data`, `src/components/{charts,controls,panels,ui}` and
`src/fixtures/data` directories are in place for waves 1–9.
