Type: research
Status: resolved
Label: wayfinder:research

# Charting and UI library fit

## Question

What should render this dashboard's charts, given that every dimension carries user-switchable
roll-up levels?

## Scope

The requirement that makes this non-obvious: `CONTEXT.md` § Aggregation Dimensions means a
single chart must re-group live across Member → Team → Org, exact model → family → tier,
repository → work domain. Regrouping and re-legending on the fly, not four separate charts.

- **Tremor**: current maintenance status, the v3 → Tremor Raw transition and what it means for a
  new project in 2026, licensing, React 19 / Next.js 15 App Router compatibility, and how well
  its chart components tolerate dynamic series.
- **Alternatives**: shadcn/ui charts, Recharts directly, visx, Nivo, Observable Plot,
  ECharts. Compare on dynamic re-grouping, server-component compatibility, bundle cost,
  accessibility, and testability (see ticket 09 — chart output has to be assertable).
- Whether any of them force a chart-per-grouping structure, which would be disqualifying.

## Why it is being asked

Tremor was chosen in the archived v1 handover *before* the roll-up requirement existed. That
choice needs to be re-tested against a requirement it was not made under.

## Deliverable

A brief at `.scratch/agent-dash/research/04-charting-library-fit.md`, sources cited, with a
comparison table and the trade-offs stated. Recommend if the evidence is one-sided; flag it as
a human call if it is not.

## Answer

Brief: [`.scratch/agent-dash/research/04-charting-library-fit.md`](../research/04-charting-library-fit.md)
— 898 lines, ~90 primary-source citations, all dated. Resolved 2026-09-05.

**Settled by evidence — Tremor is disqualified.** The evidence is one-sided, so this half needed
no human call:

- `@tremor/react` last shipped `3.18.7` on 2025-01-13 (20 months) with
  `peerDependencies.react: "^18.0.0"` — React 19 is excluded outright.
- Tremor Raw's last substantive commit was 2025-04-12; an outside React 19 upgrade PR has sat
  unreviewed since 2026-06-11.
- Tremor's co-founder, on the Vercel forum (2025-08-07): *"net-new development will be happening
  in shadcn/ui."*
- **The decisive detail**: Tremor Raw's one open chart bug (#126, open since 2025-03) sits *inside
  the `categories.map()` loop* — precisely the code path a roll-up switch drives through. The
  requirement this project added after Tremor was chosen runs straight through its unfixed defect.
- Both Tremors pin Recharts 2.x, which the Recharts maintainer formally deprecated on npm
  (#7361, 2026-05-24): *"I doubt there will ever be another one."*

**Also settled — ECharts is out on operational grounds.** `echarts-for-react` was compromised in a
May 2026 npm supply-chain attack; the compromised artifacts remain published with no GHSA, and
`size-sensor@^1.0.1` still resolves into the bad version.

**The re-grouping test came back clean.** All six candidates drive series from runtime arrays and
none is disqualified on dynamic re-grouping — they differ only in ceremony. The requirement that
motivated this ticket turned out not to be the discriminator; maintenance health was.

**Not settled — one genuine judgement call**, correctly left to a human and graduated to
[ticket 14](14-charting-library-selection.md): shadcn/ui charts on Recharts 3 versus Observable
Plot.

Consequences: testability findings handed to 09; ticket 14 graduated; the archived v1 stack
choice of Tremor is now formally dead.
