Type: research
Status: resolved
Label: wayfinder:research

# Actionable signals across LLM-first autonomous execution platforms

## Question

Across the field of LLM-first autonomous execution tooling, what do analytics surfaces actually
put in front of an organisation — what is each product's core value proposition, what metrics and
dimensions does it expose, what operational units and reports does it build its business process
around, and which of those signals are positioned as the actionable ones?

## Why this exists

Charted 2026-09-05, after a grilling session. Distinct from tickets 01 and 02, which catalogued
what vendors *ship* (metric families, grain, gating, rate-card structure). This ticket asks a
different question: what the field has *learned* — the signals it markets as actionable, and the
gaps between those and what an individual contributor, a team lead, or a FinOps owner would
actually find valuable.

## Scope

**Cut: wide.** LLM-first autonomous execution as a broad picture — cloud/async agent execution
platforms, IDE-resident assistants with org analytics, and the engineering-analytics and FinOps
tooling that reports on them. Breadth over depth on any single vendor.

**Zencoder AI is in the survey**, as an ordinary row. No special framing, no anchoring the
comparison against it.

Four axes, all four required:

1. **Core value proposition.** What each product claims to sell an organisation, in its own words.
2. **Metrics and dimensions.** What is exposed, at what grain, to whom.
3. **Operations, units and reports.** The operational unit each product meters in, and the
   reporting artefacts it builds its business process around.
4. **Most actionable signals.** Which signals are positioned as the ones to act on.

## Method

**Clean slate.** This ticket is answered from first principles. The researcher must NOT read
`.scratch/agent-dash/research/` (briefs 01-04) or `.scratch/_archive/` during the gathering pass.
Convergence with the earlier briefs is then worth something as independent corroboration; that is
the whole reason for the constraint. Decided over the objection that it re-buys settled findings —
accepted knowingly, in exchange for an independently-derived artefact to groom against.

**Context the researcher gets:** `CONTEXT.md` and `docs/assignment.md`. Nothing else from this repo.

**Actionability is inferred, and labelled as inference.** Read it off *prominence* (what sits on
the default view with no configuration, what is sortable or rankable by default, what fires an
alert or a digest, what is in an API's default response) plus *marketed purpose* (how the vendor
says the signal is meant to be used). Tag each with an actionability category — cost control,
efficiency gain, per-engineer ranking, and whatever else the field turns out to use. This is
evidence of what a vendor *believes* drives action. It is not evidence that it works, and the
brief must say so.

**Sourcing.** Actionable metrics and insights, not keyword fluff. First-party product
documentation, admin/analytics API references, changelogs and deprecation notices, vendor
engineering retrospectives, and practitioner accounts that name specifics. Others' struggles and
published research are a legitimate lens throughout. Content-marketing listicles are not a source.

**Every claim is tagged `evidenced` or `reasoned`.** Reasoning from first principles is welcome
and expected; it just has to be distinguishable from a sourced claim, because after grooming the
two are indistinguishable otherwise.

**Gaps are framed by audience, not by baseline diff.** For each gap: which of individual
contributor, team lead, or FinOps owner would find the signal valuable, and on what basis. There
is no baseline to diff against — `CONTEXT.md` § Metric Concepts is declared incomplete, so
diffing against it would manufacture false gaps. Inventory outward; ticket 05 and ticket 08 diff
inward when they are answered.

## Constraints

**Observational phrasing only.** The brief reports what the field does. It never proposes what
this dashboard should show. Tickets 05 (metric set) and 08 (dimension taxonomies) are HITL and
are answered by the human; a gap is written as a question addressed to them, never as an answer.
Pre-answered tickets are why v1 of this map was archived.

**FinOps is a research lens, not a role preset.** Ticket 06 (the role preset table) is open and
untouched by this ticket. The brief may describe FinOps as a buyer; it may not assert that a
FinOps preset ships in this product.

**"Offenders and MVPs among engineers" is a market observation.** Where the field ranks named
engineers by spend or output, record it as fact, prominently — the contrast with this product is
analytically interesting. `docs/adr/0001-peer-visibility-excludes-cost.md` stands and this ticket
does not reopen it.

## Deliverable

`.scratch/agent-dash/research/15-actionable-signal-landscape.md`.

**Written in two passes, in this order:**

1. The clean-slate brief, complete, saved.
2. *Then* read briefs 01 and 02, and append a closing **Reconciliation** section: where this brief
   independently corroborates them, where it contradicts them, and where it found something they
   did not.

**Known limitation of the reconciliation, stated up front.** `CONTEXT.md` already carries brief
02's conclusions in prose — the token-class hazards, the tier price spread, the absence of vendor
precedent for family/tier roll-ups. Because the researcher is handed `CONTEXT.md`, the closing
diff on units, tokens and cost can only catch *contradictions*; it cannot claim independent
corroboration on that axis. Elsewhere the corroboration claim holds. Do not overclaim it.

## Answer

Resolved 2026-09-05. Brief: `.scratch/agent-dash/research/15-actionable-signal-landscape.md`
(2,637 lines; ~30 vendors across four product classes; 164 `[E]` / 134 `[R]` / 10 `[E?]` tagged
claims; source index included).

**The field ranks named engineers by default, and publishes the rationale.** Google Workspace's
user-level usage report has been default-on since 2026-02-16, bucketing every named employee with
a top tier of *"the top 10% of users"*. Anthropic's `user_cost_report` returns engineers sorted by
dollar spend as its **default sort**. Cursor ships `/leaderboard`; Cline shows a "TOP SPENDING
USERS" panel; AWS ships a Kiro "Top 10 Users" leaderboard as sample code. Two products surveyed
cannot attribute per-engineer at all (Qodo; Zencoder's *manager* dashboard — "Every metric is
team-level", which its own *analytics* dashboard contradicts with a Member Activity table keyed on
email). Exactly one ships an identity-stripping switch: Factory's `telemetry.granularity:
aggregate`, citing works-council jurisdictions. Every published justification is enablement or
budget adjudication; none is evaluation.

**The two largest vendors publicly disagree on the headline metrics.** Anthropic leads with
lines-accepted and accept rate; OpenAI's Codex docs list both under *"What it does not provide"* —
LOC "a noisy proxy… can incentivize the wrong behavior", accept rate "almost 100% since users
usually accept the change first" — while retaining a per-user ranking table with a streak column.

**Every alert in the field fires on money.** Across ~15 vendors: spend and quota only. Nothing
alerts on failure rate, rework or quality. Enforcement is trending individual — GitHub's $0 user
budget hard-blocks a named developer; Devin gates budget increases on a per-member efficiency score.

**Vendor belief and published evidence barely overlap.** The signals with the best evidence —
rework, review-stage timing, cost per accepted change — are the ones no agent platform ships.

### Thirteen gaps, each framed by audience and addressed to 05/08

Attempt outcome; rework; cost-per-outcome; a roll-up above Repository; agent-config provenance;
peer-aggregate visibility for non-admins; non-financial alerting; estimate-to-invoice
reconciliation; the IC's own view; quality; model mix as a lever rather than a breakdown; what the
individual actually did; and **seat cost** — Finout, Anthropic and CloudZero independently document
that seat and subscription fees are invisible to usage APIs, so a usage-derived cost-per-engineer
under-reports by the seat fee plus whatever the allowance absorbed. For a low-usage engineer that
is nearly the whole cost, which distorts the *ordering*, not merely the total.

### Contradictions against earlier work

1. **GitHub's aggregate-only, ≥5-user Copilot Metrics API was sunset 2026-04-02** — brief 01's
   "single most transferable finding". The replacement is twelve endpoints including `users-1-day`
   keyed on `user_login`; the ≥5 rule survives only on team roll-ups and explicitly does not
   suppress per-user rows. **This corroborates ticket 12's decision to impose no population
   floor**: the sole industry precedent for one no longer protects individuals, and the lone
   surviving privacy control in the field is an opt-in aggregation switch, not a k-threshold.
2. **`CONTEXT.md`'s "no vendor precedent" claim was half-wrong** — Anthropic's spend CSV carries
   `Model family`, and FOCUS 1.5 drafts a standards-track `ModelFamily`. **Tier survives intact**,
   and FOCUS's note that `ModelId` is "not guaranteed to match across service providers" strengthens
   the tier bet. Corrected in `CONTEXT.md` § Models & Money on resolution.

### Known defects in this brief

- **It missed DORA's 2025 re-cut to five metrics**, including a split-out **Deployment Rework
  Rate** — which brief 01 has, and which sharpens this brief's own rework gap.
- **Quote fidelity varies by extraction path.** A substantial share of quotations came through a
  summarising fetch layer rather than raw HTML. Treat as high-fidelity but re-verify anywhere the
  exact wording is load-bearing.
- **Written against pre-ticket-12 documents.** The brief was gathered clean-slate against the
  `CONTEXT.md` and ADR-0001 that existed before ticket 12 landed, and its ticket asserted that
  ADR-0001 "stands and this ticket does not reopen it". Ticket 12 has since amended ADR-0001,
  added ADR-0002, and added the `cohort` scope with the per-class comparison model. The brief's
  Reconciliation section therefore diffs against superseded documents. Its *findings* are
  unaffected — they are observations about other vendors — but any re-read of that section must
  be done against the current documents. The map collision noted before resolution is discharged
  by this paragraph.
