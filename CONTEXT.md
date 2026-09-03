# Domain Glossary

## Core Entities

**Organization** — The top-level billing and access-control unit. An org subscribes to the platform and manages members. All analytics are scoped to an org.

**Member** — An engineer who belongs to an Organization and runs AgentSessions. A Member has a role: `admin`, `member`, or `viewer`.

**AgentSession** — A single discrete invocation of a cloud coding agent by a Member. Has a start time, duration, status (`completed` | `failed` | `interrupted`), token usage, and cost. The atomic unit of platform activity.

**TokenUsage** — The breakdown of tokens consumed within an AgentSession: `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`.

**Cost** — The dollar amount derived from TokenUsage and compute time for an AgentSession. Rolled up to Member, Team (if present), and Org levels.

## Roles (Dashboard Personas)

**Admin** — Org-level administrator. Sees all data: org-wide usage, cost, member breakdown, quota management. Maps to FinOps / Engineering Manager concerns.

**Member** — Individual engineer. Sees their own session history, personal usage, and personal cost. Sees org-level aggregates (read-only, no member breakdown of others).

**Viewer** — Read-only observer (e.g. finance, leadership). Sees org-wide aggregates and cost; no member-level drill-down.

## Metric Concepts

**Active Sessions** — Count of AgentSessions in a given period with status `completed` or `failed` (i.e., not abandoned before start).

**Session Duration** — Wall-clock time from session start to end. Median and p95 are the meaningful aggregations.

**Token Spend** — Total tokens consumed (input + output) across AgentSessions in a period.

**Cost** — Monetary spend derived from token pricing. Shown as total, per-member breakdown (admin only), and trend over time.

**Success Rate** — Percentage of AgentSessions with status `completed` vs `failed` or `interrupted`.

## Additional Entities

**GitHubOrg** — The external GitHub organization linked to a platform Organization. Source of truth for team and member import.

**GitHubTeam** — A team within the linked GitHubOrg. Platform Members are grouped by their GitHub team membership. The hierarchy is: Organization → GitHubTeam → Member.

**Repository** — A GitHub repo within the connected GitHubOrg. AgentSessions are tagged to a Repository. "Project" in the UI means Repository.

**AgentTemplate** — A named, versioned agent configuration. Three kinds:
- `vendored` — built-in templates shipped by the platform
- `user_tuned` — derived from a vendored template, customized by a Member or Org
- `api_provided` — templates registered via the platform API (third-party or org-authored)

AgentSessions reference exactly one AgentTemplate.

## Site Structure

Public (SSR, SEO-indexed):
- `/` — Landing: hero + "Open Demo" CTA + sign-in entry
- `/demo` — Live dashboard demo (fixture data, no auth required)
- `/login` — Mock OAuth entry: GitHub / Google / Email-SSO flows (simulated, auto-redirect)

Authenticated app (role-gated, fixture data):
- `/dashboard` — Overview
- `/dashboard/usage` — Usage analytics
- `/dashboard/cost` — Cost analytics
- `/dashboard/members` — Member management (admin only)

No `/features`, `/compare`, or `/pricing` pages — the dashboard is the Claude value prop.
Competitor list (LinearB, Waydev, GitHub Copilot Workspace, Cursor) retained as internal reference for metric framing only.

## Decisions Made

- Platform archetype: Claude Code on the Web (cloud coding agent)
- Dashboard audience: all three roles (Admin, Member, Viewer) with role-gated views
- Org hierarchy: Organization → GitHubTeam → Member; sessions tagged to Repository
- MVP surface: multi-section SPA (Overview, Usage, Cost, Members) + full marketing site
- Frontend: Next.js (App Router, SSR for SEO + AI-discovery from public landing)
- UI library: Tremor (analytics-native, Tailwind-based)
- Mock data: static JSON fixtures (deterministic, fully testable)
- Testing: Vitest + React Testing Library (unit/integration) + Playwright (e2e)
- Agent sessions reference an AgentTemplate (vendored | user_tuned | api_provided)
- Auth: mock login page has two modes — (1) "Try as" demo tiles (Admin / Member / Viewer, instant access) and (2) OAuth-like signup flow (GitHub / Google / Email-SSO) with role picker framed as onboarding value prop; no real provider
- Landing hero: outcome-first copy ("Ship faster. Know why.") — JTBD-led, dashboard as proof
- No marketing sub-pages (features/compare/pricing) — dashboard is the value demonstration
- Agent template taxonomy: deferred, placeholder set in fixtures
- Deployment: Vercel (free tier)
- Metrics: pending human sign-off (Task #1)
