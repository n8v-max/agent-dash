# Roadmap and recorded cuts

What is worth building next, in what order, and what was deliberately not built. Each cut compresses
reasoning already recorded in an ADR, in `spec.md` § 1.1, or in the ticket that closed it.

**The ordering is one argument.** The claim is Cost per completed Task — a ratio over an attributed
figure this application does not compute (ADR-0005), against a rate model that estimates an invoice
rather than reproducing one (`CONTEXT.md` § Token class). **Next** completes that figure; **Then**
acts on it; enforcement waits for **Later**, because a limit is only as defensible as the number it
fires on.

## Next

**BYOK splits Total spend** — deferred as a decision record, `docs/adr/0010-byok.md`. Under BYOK the
token cost lands on the customer's vendor invoice and the platform bills seats and machine time, so
Total spend — the only figure representing what the Organization actually pays — hides most of the
money. Intended: `billing_owner` on TokenUsage, and two stacks, "billed by us" and "billed by your
vendor".

**Agent identity and version as a dimension.** ADR-0008 made a fan-out legible in *size* — Agents
per session, median and p95 — and not in *composition*: the roll-up knows a root ran four agents,
not which four, so a regression in one agent version hides inside every aggregate containing it.

**Tool and MCP call counts per session.** `prompt_count` is deliberately the only interaction-volume
measure (`CONTEXT.md` § Session measures), and it counts the human; nothing counts what the agent
did between prompts, which is where a `headless` session's cost is made. Precedent exists now where
ticket 02 found none: Anthropic's OTel `mcp_server.name` and `mcp_tool.name` (brief 15).

## Then

**A recommendation per WorkType** — move this work to a cheaper tier; this WorkType carries rework
risk. Per WorkType, because criteria differ by type and there is no Organization-level acceptance
rate (R-M6). The 200× tier spread (ADR-0007) makes the first worth saying; Rework rate makes the
second falsifiable.

**CSV export.** A finance team will have a question this dashboard does not answer. Cheap because
the computation/rendering seam is a ViewModel (ADR-0006): the rows already exist one layer down.

**As-of freshness alerting.** Every surface carries an as-of stamp (R-N3.1); alerting is what makes
it load-bearing rather than decorative, since a stalled pipeline currently reads as a quiet month.

## Later — budgets and enforcement, once the numbers have earned trust

Quota, budgets, enforcement, spend alerting: out of scope today (`spec.md` § 1.1) and last on
purpose. This is an analytical dashboard, not a control plane — cost *projection* is in, cost
*limits* are out — and the sequencing is an argument, not squeamishness.

- **The figure is not invoice-grade.** Cache-write TTL is collapsed and the rate-card key is
  collapsed to (model × token class); the product states that it estimates an invoice rather than
  reproducing one. A budget blocking work on that number enforces a rounding decision.
- **Enforcement over a distrusted measure produces tokenmaxxing, not thrift.** ADR-0003 carries the
  record: Amazon's KiroRank raised compute spend with no matching value, and Microsoft budgeted at
  *division* level rather than per person. A limit is a stronger incentive than a leaderboard, and
  so a stronger version of the same failure.
- **Nothing above needs it.** Each Next and Then item ships value whether a limit fires or not.

## Cuts, with reasons

- **Quality signals** — defect, revert and change-failure rates need Git and incident systems the
  platform does not own, and it does not own the Task's lifecycle either (`spec.md` § 1.1).
- **A designed zero-data state** — ticket 11, `wontfix`. `/demo` always carries data, and a panel a
  filter empties falls back to plain text with shell and controls intact. First run is undesigned.
- **Vendor-shaped token normalisation** — ticket 13, `wontfix`. Fixtures are authored directly in
  the four disjoint classes, so no vendor reading is parsed and nothing can be un-normalisable. The
  cost: multi-vendor by assertion rather than by demonstration.
- **Role authoring UI** — Roles are data (`CONTEXT.md` § Access), and since `spec.md` § 11 C9
  withdrew the permission matrix nothing renders them at all. Authoring from a surface that does not
  exist is two features, not one.
- **Real OAuth, live APIs, a real GitHub App** — fixture data throughout (`spec.md` § 1.1). Two
  JWT-holding accounts demonstrate the access model; an identity provider would demonstrate an
  identity provider.
- **Seat cost visible to the restricted account — an accepted leak** (human decision, 2026-09-09).
  The seat fee is flat and period-stable, so a restricted account reading its own Total spend split
  learns the Organization's per-seat price — a `cost` fact about every human Member, not only itself
  — and times any headcount it can reach, that is somebody else's seat bill. Accepted rather than
  suppressed: seat cost is ~46% of Total spend, a total without it is the wrong number, and hiding
  the split would make the restricted view a different page rather than the same page with fewer
  rows (R-A5, R-A8). The claim is that this product does not *display* a figure outside a grant,
  never that the figure is unrecoverable — as ADR-0003 says of subtraction.
