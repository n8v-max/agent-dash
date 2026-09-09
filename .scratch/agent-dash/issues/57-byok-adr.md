Type: implementation
Status: resolved
Blocked by: 48
Label: resolved

# ADR-0010 — Bring-your-own-key splits Total spend (deferred)

## Scope

Decision record only, no code. Under BYOK, token cost lands on the customer's vendor invoice and
the platform bills seats and machine time. Total spend then hides most of the money. Intended
change: `billing_owner: "platform" | "customer_key"` on TokenUsage; Total spend renders two stacks,
"billed by us" and "billed by your vendor"; hidden-session cost cannot be absorbed by the platform
under a customer key, so the hidden rule needs a second clause. State why it is deferred and what
it costs to retrofit.

## Done when

`docs/adr/0010-byok.md` exists, status Proposed, linked from the roadmap.

## Comments

### 2026-09-09 — recorded (AFK wave 2, worktree `agent-dash-t57`)

`docs/adr/0010-byok.md`, **status Proposed**, at exactly the path ticket 50's roadmap links to.
0009 was free too; 0010 was used as instructed, and the gap is deliberate rather than an accident
to renumber. No code changed — the diff is this file and the ADR.

**What the ADR fixes.** Five clauses for when BYOK ships: `billing_owner` on **TokenUsage** rather
than on AgentSession (a key is per vendor, a session routes across vendors, so a mixed session
exists and session grain cannot express it); Cost still attributed upstream but attributed *twice*,
so ADR-0005 is extended and not reversed; Total spend as two stacks, legitimate because
`billing_owner` partitions where § 11 C11's WorkType-over-Tasks does not; Cost per completed Task
keeping **both** stacks in its numerator, because otherwise a move to BYOK reads as a step change in
engineering efficiency; and the vendor figure sourced from the vendor or **absent** in R-M18/R-V10's
sense, never priced from our own card — which is the one thing OpenRouter does that we cannot copy.

**The hidden-session clause is the substance.** The platform cannot absorb a customer-key session's
token cost: the vendor charged the customer at the moment of spend and no platform-side write-off
retracts it. So `CONTEXT.md`'s second half narrows from *"no metric and no view"* to **no
platform-billed metric and no session-grain view** — the money appears in the vendor-billed total
carrying no session, Member, Repository or Task. That is what makes this more than a column: R-M2 is
one filter on one line of `load.ts`, and ADR-0008 put the child roll-up there on purpose; BYOK makes
the visible population and the billed population two populations, with money crossing a boundary
sessions must not.

**Escalated, per the escalation rule — where that money crosses.** Two placements, no spec to settle
it: `load.ts` returns a session-less vendor total beside `sessions`/`childSessions`, or hidden rows
survive into the domain layer behind a flag every aggregate must respect. **Took the cheaper one**
(the session-less total), because the second *is* the per-query fold ADR-0008 refused and the first
aggregate to forget it publishes a hidden session's Member. **Cost recorded in the ADR**: the
fixture's 15 hidden rows of 1,049 become load-bearing where they are discarded today, and a fixture
invariant has to pin that total.

**Alternatives weighed and recorded, six of them**: build it now; price BYOK from our own card and
blend one total (the OpenRouter shape — rejected as ADR-0005 in reverse plus an "estimated" marker
inside Total spend); a zero rate (reads a transfer as a discount); `billing_owner` at session grain
(cheaper, unrepresentable for mixed sessions, recorded because someone will propose it); a separate
panel beside Total spend (**kept as the explicit fallback** if ticket 55 finds the vendor bill
obtainable only at org-month grain); and keeping the Hidden rule untouched with the ~1.4%
reconciliation gap accepted.

**Retrofit cost is named rather than gestured at** — `TokenUsage`'s `Record` shape, `tokenUsageSchema`
forcing all 25 session fixture files to be regenerated, `CostBearing`/`totalSpend`, `aggregate.ts`,
`projection.ts`, the `SEAT_GROUPS` stack and `seatShare` ViewModel, five surfaces, the generator's
`pricing/spend/targets/invariants` chain, and the tests — with `money-labelling.test.tsx` (T-C9)
called out as the one a priced BYOK figure would fail outright.

**Left open.** Whether the vendor bill is obtainable at a grain that joins to a session is ticket
55's to answer, and this ADR is contingent on it — OpenRouter's own `byok_usage_inference` arrives
at `date × model`, which joins to nothing here. Also open, and flagged in the ADR: R-D4's seat share
would have to be restated over a denominator whose composition the generator picks, which needs new
targets and a new invariant band. **`CONTEXT.md` and `spec.md` were deliberately not amended** — the
ADR is Proposed, and its Consequences list every amendment acceptance would require so that the edit
is bounded rather than discovered.

**Gates**: `lint` clean · `typecheck` clean · `test` **1348** across 61 files · `build` green.
`test:coverage` and `e2e` skipped under the wave rule — the diff touches no file under `src/` or
`e2e/`.
