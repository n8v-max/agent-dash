Type: research
Status: ready-for-human
Priority: MEDIUM

# Confirm agent template taxonomy for fixture and Usage filter

## Question

What are the canonical AgentTemplate names to use in fixtures and the Usage tab filter?

## Placeholder set (proposed in Q16)

| Slug | Display name | Description |
|---|---|---|
| `code-review` | Code Review | Reviews a PR diff, leaves inline comments |
| `bug-fix` | Bug Fix | Diagnoses and patches a failing test or bug report |
| `test-gen` | Test Generation | Generates unit/integration tests for a target file |
| `refactor` | Refactor | Applies a named refactor pattern |
| `doc-gen` | Documentation | Writes or updates docstrings/README sections |
| `dependency-update` | Dependency Update | Bumps deps, runs tests, opens a PR |

## Context

Template type is a filter dimension in the Usage tab. Names appear in: chart legends, filter dropdowns, Members table tooltips, and the session detail view. They need to feel like real agent templates a developer would actually run.

## Feeds into

Fixture schema (05), Usage filter component, session detail UI.

## Decision needed

Confirm the placeholder set, trim, add, or rename. If product research (02) surfaces better names, incorporate those first.

## Comments
