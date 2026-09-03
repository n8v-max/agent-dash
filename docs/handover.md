# Project Handover: Agent Dashboard

Status: design tree complete — ready for specs  
Session: grilling + domain-modeling complete 2026-09-04

---

## What We're Building

A **customer-facing, org-level analytics dashboard** for an imaginary cloud agent execution platform (archetype: Claude Code on the Web). Engineers and their managers see how their organisation uses AI coding agents — sessions, token spend, cost, team breakdown, and template usage.

The dashboard IS the product demonstration. No separate marketing sub-pages. The public landing page feeds directly into a live demo and mock-auth login.

---

## All Design Decisions (settled)

| # | Decision | Answer |
|---|---|---|
| Q1 | Platform archetype | Claude Code on the Web — sessions, token usage, cost |
| Q2 | Primary personas | All three: Admin (EM/FinOps), Member (engineer), Viewer (leadership) with role-gated views |
| Q3 | MVP surface | Multi-section SPA: Overview, Usage, Cost, Members + public landing + demo |
| Q4 | Frontend | Next.js (App Router, SSR for SEO + AI-discovery) |
| Q5 | Mock data | Static JSON fixtures (deterministic, fully testable) |
| Q7 | Org hierarchy | Organization → GitHubTeam → Member; sessions tagged to Repository |
| Q8 | Site scope | Landing + Demo + Login only — no /features, /compare, /pricing |
| Q9 | Metrics | Pending human sign-off (Task #1) — see proposed set below |
| Q10 | Agent types | AgentTemplate system: vendored / user_tuned / api_provided |
| Q11 | UI library | Tremor (analytics-native, Tailwind-based) |
| Q12 | Testing | Vitest + RTL (unit/integration) + Playwright (e2e) |
| Q13 | GitHub integration | Simulated — fixture data includes GitHub-shaped entities, no real OAuth |
| Q14 | Auth | Mock login: "Try as" demo tiles (Admin/Member/Viewer) + OAuth-like signup with role picker |
| Q15 | Marketing pages | Discarded — dashboard is the Claude value prop |
| Q16 | Template taxonomy | Deferred — placeholder set in fixtures, refine post-research |
| Q17 | Competitors | List retained for internal metric framing: LinearB, Waydev, GitHub Copilot Workspace, Cursor |
| Q18 | Deployment | Vercel free tier (CI on push) |
| Q19 | Login UX | Two modes: (1) demo tiles for instant role-switching, (2) OAuth-like signup with value prop framing |
| Q20 | Landing hero | Outcome-first: "Ship faster. Know why." — JTBD-led copy, dashboard as proof |
| Q21 | Fixture scale | B: 1 org, 4 teams, 20 members, 180 days — gap flagged for schema design |
| Q22 | Repo | Public on GitHub, already set up |

---

## Domain Model (key entities)

- **Organization** — top-level billing/access unit
- **GitHubTeam** — group within org, imported from GitHub
- **Member** — engineer; roles: `admin` | `member` | `viewer`
- **Repository** — GitHub repo tagged to sessions ("Project" in UI)
- **AgentSession** — atomic unit: one agent invocation, has duration, status, TokenUsage, Cost, template ref
- **AgentTemplate** — named config: `vendored` | `user_tuned` | `api_provided`
- **TokenUsage** — `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`
- **Cost** — derived from TokenUsage + compute, rolled up per member/team/org

---

## Route Map

```
/ (public, SSR)              Landing — "Ship faster. Know why." hero + demo CTA + sign-in
/demo (public, SSR)          Live dashboard with fixture data, no auth
/login (public)              Mock auth: demo tiles + OAuth-like signup flow

/dashboard (auth)            Overview — KPI cards, sparklines, success rate
/dashboard/usage (auth)      Usage — session charts, duration, token breakdown
/dashboard/cost (auth)       Cost — spend trends, per-member/team breakdown (admin)
/dashboard/members (auth)    Member table — admin only
```

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR for landing/demo SEO; API routes for mock endpoints |
| UI | Tremor + Tailwind CSS | Analytics-native components (stat cards, charts, tables) |
| Charts | Tremor (Recharts under the hood) | Covered by Tremor — no extra lib |
| Auth | next-auth (credentials provider, mock) | Real session/JWT, zero backend, three fixture accounts |
| Mock data | Static JSON in `/lib/fixtures/` | Deterministic, tree-shakeable, fully testable |
| Testing | Vitest + RTL + Playwright | Unit/integration + e2e on key flows |
| Deployment | Vercel (free, CI on push) | Zero-config Next.js, preview URLs per PR |

---

## Proposed Metrics (Task #1 — pending sign-off)

**Overview** (all roles)
- Total sessions, total tokens, total cost — vs prior period (% Δ)
- Sessions-over-time sparkline (7d / 30d / 90d toggle)
- Success rate gauge (completed vs failed vs interrupted)
- Top 3 most active members (admin/viewer) or personal rank (member)

**Usage** (role-scoped)
- Sessions by day/week bar chart
- Median + p95 session duration
- Token breakdown stacked bar (input / output / cache_read / cache_write)
- Filters: date range, team (admin), template type

**Cost** (role-scoped)
- Total cost trend line
- Cost per member ranked list (admin only)
- Cost per team bar chart (admin only)
- Projected month-end spend

**Members** (admin only)
- Table: member, team, sessions, tokens, cost, last active, role
- Role display (no live mutations in mock)

---

## Open Gaps (prioritised)

### G1 — Metrics sign-off `BLOCKER`
The fixture schema cannot be finalised until the metric set is approved. Review the proposed set above and confirm or edit before spec work starts.
**Owner**: human decision. **Unblocks**: fixture schema, chart component selection.

### G2 — Fixture data schema design `HIGH`
Fixture scale is settled (B: 4 teams / 20 members / 180 days) but the shape isn't. Need:
- Session event grain (one row per session vs daily aggregates)
- How cost is stored (pre-computed field vs derived at read time)
- Template placeholder names (6 proposed in Q16, needs confirmation)
- Realistic variance patterns (success rate ~85%, duration distribution, token range)
**Owner**: can be AI-designed; recommend a dedicated research/design pass before coding starts.

### G3 — Landing page evolution path `MEDIUM`
Current landing is a minimal gateway ("Ship faster. Know why." → demo + login). As the platform matures this would grow into a full site. The gap to capture:
- What signals would trigger adding /features, /pricing, /compare?
- Should the landing route be architected to receive those sections without a rewrite? (Segment-based routing in Next.js makes this trivial — flag it in the tech spec as a deliberate extension point.)
**Owner**: product decision. **Now**: build the gateway; leave the extension seam.

### G4 — Interview date / submission deadline `HIGH`
The assignment says "share repo link one day before the interview." Date unknown at handover time.
Vercel deploys on every push so no manual step — but spec work and coding need a target date.
**Owner**: confirm with recruiter.

### G5 — Empty / zero-data state `MEDIUM`
What does the dashboard show for a brand-new org with no sessions? Options:
- "Connect GitHub to get started" onboarding prompt
- Skeleton charts with a "no data yet" overlay
- Auto-seed a small fixture sample as if the org just started
Design this explicitly — interviewers who poke around an empty state will notice if it's an error page.
**Owner**: product + design decision. **Recommendation**: onboarding prompt with a "Load sample data" shortcut.

### G6 — Agent template taxonomy `MEDIUM`
Q16 deferred this. The fixture and Usage filter need at least 3–4 template names.
Placeholder set proposed: `code-review`, `bug-fix`, `test-gen`, `refactor`, `doc-gen`, `dependency-update`.
Research fork (tech/product) should validate these against real agent-platform offerings before spec is written.
**Owner**: research fork → human sign-off.

### G7 — Mobile / responsive scope `LOW`
Tremor is responsive by default. No explicit breakpoint testing is scoped.
Dashboard analytics are typically desktop-first; flag for the tech spec that Playwright e2e runs at 1280×800.
**Owner**: accept as-is unless interviewer feedback changes priority.

### G8 — Dark mode `LOW`
Tremor supports it via a one-line config. Nice-to-have for demo polish.
**Owner**: add to tech spec as a stretch goal.

---

## Research Directions (not yet launched)

Three forks to kick off once specs are in motion:

**Fork 1 — Tech Stack**
Next.js 15 App Router patterns for analytics dashboards; Tremor v3 component API; Vitest + Playwright config for Next.js; Vercel deployment checklist; next-auth credentials provider pattern.

**Fork 2 — Product (JTBD + Demo)**
What jobs does an eng-team analytics dashboard solve? What do LinearB / Waydev / GitHub Copilot Workspace / Cursor NOT do well for AI-agent usage? What makes the demo route feel like a "wow" in 30 seconds?

**Fork 3 — Business / Metric Benchmarks**
Industry baseline for developer-productivity metrics (DORA, PR cycle time, etc.) as reference points for the AI-agent metric set. Helps frame metric naming and benchmark callouts in the dashboard UI.

---

## Immediate Next Steps

1. **Human sign-off on metrics** (G1 / Task #1) — unblocks everything
2. **Requirements spec** (`docs/specs/requirements.md`) — one section per route
3. **Technical implementation spec** (`docs/specs/technical.md`) — component tree, data flow, API shape
4. **Testing spec** (`docs/specs/testing.md`) — Vitest unit targets + Playwright e2e flows
5. **Fixture schema design** (`docs/specs/fixtures.md`) — entity shapes + seed script
6. **Step-by-step build plan** (`docs/specs/plan.md`) — ordered task list for agentic execution
7. **Agentic build** — execute the plan, commit per task, deploy to Vercel
