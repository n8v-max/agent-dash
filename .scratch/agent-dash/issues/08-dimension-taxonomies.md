Type: grilling
Status: resolved
Blocked by: 01, 02
Label: wayfinder:grilling

# Dimension taxonomies

## Question

What are the actual values along each categorical dimension — and do they carve the data at
joints that produce insight?

## What has to come out of it

**AgentTemplate.** The template set, and the reasoning for it. The archived placeholder set was
`code-review`, `bug-fix`, `test-gen`, `refactor`, `doc-gen`, `dependency-update`, proposed with
no evidence behind it.

**Repository work domain.** The domain vocabulary — the archived starting point was mobile,
data science, backend, frontend, infrastructure config. How many, how they are assigned, and
whether a repository can hold more than one.

**Model roster.** Which vendors and models populate the fixture, and how they map onto `family`
and `tier`. Whether `frontier` / `balanced` / `fast` survives contact with a real multi-vendor
roster.

**Across all three**: do these dimensions actually interact to produce a finding? The stated
differentiator needs a sentence like *"the refactor template on infra-config repos runs on the
frontier tier and lands 40% of the time"* to be true of the data. If the taxonomies cannot
produce such a sentence, they are carved wrong.

## Blocked by

01 and 02 — **both resolved 2026-09-05. This ticket is now on the frontier.**


---

## Resolved 2026-09-07 (HITL) — the template half

**AgentTemplate is renamed WorkType and collapsed to one dimension.** Values: `research`,
`implementation`, `refactor`, `bugfix`, `review`, `deploy`. Global and flat; no repo scoping;
`vendored`/`user_tuned`/`api_provided` survives as a provenance label, not a roll-up level.
Declared at launch rather than auto-classified. `follow-up` was dropped from the proposed set as
a relation to a prior session — it is Rework, already measurable, and including it would have
double-counted the differentiator. Full reasoning and the field-level model: `CONTEXT.md`
§§ Work and Metric Concepts, and the map entry for this ticket.

**Vendor grounding** (gathered 2026-09-07): Devin ships a 15-value session `category` plus
`subcategory`, auto-classified at teardown, alongside a separate `playbook_id`; Cursor ships
`workTypes` / `categories` / `intents` / `complexity` / `guidanceLevels` on its enterprise
analytics endpoint, scoped to conversation *segments* rather than whole sessions. Claude Code,
Copilot, Gemini Code Assist and Cline have no work-type dimension at all. The six-value set
above is close to a subset of Devin's, which is corroboration rather than coincidence.

## Closed 2026-09-10 — the remaining half was answered by ticket 16

This ticket carried `partially resolved` for three days after it had stopped being partial. Both
items below were closed by [ticket 16](16-work-domain-and-model-roster.md) on **2026-09-07**, which
is where their reasoning lives; nothing further is owed here.

- **Repository work domain** — **cut, not filled.** Repository is flat and carries no work-domain
  label. One label per repository is false, several break additivity, and `Repository × WorkType`
  already meets the standard this ticket set. → `docs/adr/0004-repository-carries-no-work-domain.md`
- **Model roster** — **seven models, three vendors**, with `family` carrying the vendor.
  `frontier`/`balanced`/`fast` survived. → ticket 16 § Answer.

Both were taxonomy-*population* questions rather than model-*shape* questions, and both fed 10
directly, as this ticket predicted.
