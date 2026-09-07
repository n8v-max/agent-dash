Type: implementation
Status: ready-for-agent
Blocked by: —
Label: ready-for-agent

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

## Done when

- `components.json` records a `base-*` preset, and no `style` field naming `default` or
  `new-york`.
- `pnpm why recharts` shows a single 3.x entry.
- A deliberate `import { useState } from 'react'` inside `src/domain/` fails `pnpm lint`.
- `pnpm lint && pnpm typecheck && pnpm test` pass.

## Notes

Ticket 14 is explicit that the scaffold style is a **setup-time constraint, not an encounterable
defect** — there is no later moment at which it is discovered. Getting it wrong here is silent.
