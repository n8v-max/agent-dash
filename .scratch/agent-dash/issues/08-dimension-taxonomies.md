Type: grilling
Status: open
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
