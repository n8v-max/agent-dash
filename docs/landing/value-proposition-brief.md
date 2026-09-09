# Brief: what a swarm of cloud agents is worth to an engineering organisation

Status: draft for the human, 2026-09-10. Opened by ticket 59. Written to shape the landing, not to
replace `docs/positioning.md`; where the two disagree, the positioning is still the source until the
human moves it.

**The question as posed.** Most of the value in an agent-usage dashboard is identifying who operates
agents well and who does not, and telling an organisation whether the remote infrastructure returns
enough over engineers running LLMs locally. The sceptical prior: offloading agent work to a remote
machine is not obviously better than running it locally, unless the work is resource-intensive in
the way distributed compilation and heavy CI are. This brief takes that prior seriously, states where
it holds, where it does not, and what the dashboard can and cannot say about it.

Evidence tags follow brief 15's convention: `[E]` is traceable to a source cited in
`.scratch/agent-dash/research/`, `[R]` is reasoning in this document.

---

## 1. What a cloud swarm changes, mechanically

A laptop running an LLM-backed agent and a cloud session running the same agent differ in six
things. Each is a mechanism, not a benefit; whether it becomes a benefit depends on the work.

| Mechanism | Local | Cloud swarm | Where the dashboard sees it |
|---|---|---|---|
| **Concurrency** | One agent, one machine, one person's attention | One attempt fans out to several agents on several machines | Agents per session, median and p95 (ADR-0008); machine allocation exceeding wall clock |
| **Unattended time** | Ends when the lid closes or the terminal is needed for something else | Runs headless, or continues after the human walks away | `execution_mode`; the interactive / idle / AFK split (`CONTEXT.md` § Duration spans) |
| **Machine class** | Whatever the engineer has | `general`, `compute`, `memory`, `storage`, chosen at launch | `machine_spec`, priced into session Cost |
| **Isolation** | The engineer's own environment, credentials and disk | A disposable environment with scoped credentials | Not modelled; a platform property |
| **Attribution** | Invisible: an API key on an expense line, no session, no issue, no repository | Every session carries Member, Repository, WorkType, Task key, mode and machine spec | The whole data model; Cost per completed Job |
| **Shared configuration** | Each engineer's own prompts and tools | WorkType templates, vendored or tuned, with provenance | `WorkType.source`; acceptance rate per template |

`[R]` The last two rows are the ones the sceptical prior tends to leave out. A locally run agent is
not cheaper because it is better; it is cheaper because nobody can see what it cost or what it
produced. The moment an organisation wants either number, it needs the platform's grain, and a
laptop cannot provide it after the fact.

## 2. Where the prior holds, and where it does not

**It holds for the short, supervised edit.** One person, one small change, watching every step. The
cloud adds latency, a machine allocation, and a context switch, and returns nothing the laptop did
not already give. `[R]` This is most agent use today, and a dashboard that pretends otherwise will be
read as marketing. Shape B says so on the page.

**It does not hold in four situations.** These are the distributed-compilation conditions, restated
for agents, and each is a measurable property of an organisation's own sessions rather than a claim
about agents in general.

1. **Unattended work.** The agent runs while the human is elsewhere: overnight, during review, while
   a second task is open. The value is wall-clock the human did not spend, and the cost is machine
   time. Observable as AFK share on interactive sessions and as the headless population.
2. **Fan-out.** One task worth splitting across agents. The value is calendar time; the cost is
   several machines for one attempt. Observable as agents per session and as the gap between machine
   allocation and duration.
3. **Heavy work.** Builds, full test suites, migrations, anything CI-shaped. This is the case the
   prior already grants, and it is also the one a token count is blind to: machine-heavy, token-light
   sessions are invisible until machine time is priced. It is, here (`CONTEXT.md` § Machine
   allocation).
4. **Accountability.** Work that has to be traceable to an issue, a person and a repository, with a
   cost attached. The value is governance; the cost is the platform's refusal to launch without a
   Task key. Observable as the join itself: Cost per completed Job.

`[R]` The honest summary is that the swarm is a batch system with an LLM in it, and batch systems
pay when the job is long, parallel, heavy or must be audited. The dashboard's job is to show an
organisation how much of its own work is in those four buckets, so the decision to keep the
infrastructure rests on its own distribution rather than a vendor's.

## 3. The ROI question, answered as honestly as the data allows

**The product refuses a productivity claim, and should keep refusing.** The window is entirely
agent-assisted; there is no pre-agent baseline (`spec.md` § 1). `[E]` The best experimental
evidence agrees this is hard: METR's 2025 RCT found experienced developers 19% slower while believing
themselves 20% faster, and METR's 2026 follow-up declared its own design unreliable because engineers
would no longer submit tasks without AI (brief 15 § 8.1). `[E]` Observational studies disagree with
each other by task class: Stanford's segmentation runs from +30–40% on low-complexity greenfield to
net negative on high-complexity work in mature codebases (brief 15 § 8.2). Three strong results
disagreeing is the strongest argument that an organisation must measure itself (brief 03).

**ROI against local development cannot be computed here, and the reason is structural.** The
comparison has two sides, and the platform sees one. The cloud side is fully attributed: tokens,
machine time, seats, per session, per finished task. The local side is an engineer's time plus an API
invoice with no session grain, no task key and no outcome. Any ROI figure the product printed would
be a cloud number divided by a guess.

**What the product can give instead, and it is the right shape for the decision:**

- **Its own unit cost.** Cost per completed Job, by template and by repository, month against month.
  An organisation that knows a bug fix costs $27 through the swarm can put its own number for the
  alternative beside it. The comparison is theirs; the numerator is trustworthy.
- **The waste inside the unit cost.** Rework, priced. Seats held against near-zero use, which on the
  committed fixture are 46% of Total spend and which a per-token view cannot see. Failed attempts, in
  the numerator by construction.
- **The distribution over the four situations in § 2.** How much time was unattended, how much work
  fanned out, how much machine time sat under light token use. If the answer is *"almost none"*, the
  sceptical prior is confirmed on the organisation's own data, and the dashboard has done its job by
  saying so.

**What would be needed to answer the ROI question properly.** `[R]` One of: a local-execution
telemetry counterpart with the same session grain, which is a product the platform does not own; a
per-Task effort estimate supplied by the organisation from its tracker, which imports a denominator
it does not control; or developer-level randomisation of the kind METR is redesigning toward, which is
a study rather than a dashboard. None is in the roadmap, and the roadmap should say why if the
landing raises the question.

## 4. Two readers, two goals

The value splits cleanly by who is reading, and the two readings use the same rows.

**Engineering leadership** wants three things: to control the cost, to evaluate whether the cost is
worth carrying, and to know how individuals operate agents.

- *Cost control* is the spine already built: Total spend, Cost per completed Job, the three levers,
  the projection.
- *Cost evaluation* is § 3: the unit cost and the distribution over the four situations, so the
  keep-or-cut decision is made on the organisation's own numbers.
- *How individuals operate agents* is where the record draws a line the copy must respect. `[E]`
  Every vendor in brief 15 that shows named usage justifies it as enablement or budget and never as
  evaluation; the two that ranked people on it, Meta's Claudeonomics and Amazon's KiroRank, were
  withdrawn, and KiroRank raised the compute bill it was meant to reduce (ADR-0003). The product's
  answer is already in the code: ordered by output rather than spend, a named comparison group
  instead of a percentile, symmetric visibility, no leaderboard (R-M15, R-N17, ADR-0003). The landing
  can say *who has learned to run agents well* and *who is paying for a machine to host a chat*; it
  should not say *performance*, and if it does, `positioning.md` § Not moves first.

**Individual contributors** want to find the people to learn from.

- `[E]` The self view is the best-evidenced vantage point in the whole record: Meyer et al. (CSCW
  2018) found an 84.5% awareness gain from personal workflow analytics, with peer comparison both the
  value and the thing needing care (brief 03).
- What the product gives: the Member's own four figures, always, by name (R-A3.1); the comparator
  against the median of people doing the same work in the same repository, group named and sized
  (R-N17); and under the open default, any colleague's profile with their template mix and their
  numbers.
- `[R]` What it does not yet give, and what the IC framing asks for: the *how*. A colleague's model
  mix and unattended share on their profile would turn *"they finish more per dollar"* into *"they
  run bug fixes headless on the balanced tier"*, which is the thing worth learning. Both are one
  panel each, from ViewModels the façade already produces at population grain. The roadmap's *tool
  and MCP call counts* and *agent identity* items are the next two pieces of the same how.

## 5. Where each value already lives, and what would need building

| Value | Exists today | Gap |
|---|---|---|
| Unit cost joined to output | `/demo` tile 4, `/demo/spend` panel 1 | — |
| Waste: rework, seats, failed attempts | `/demo/work` panel 3, `/demo/spend` panel 2, R-M1 | — |
| Unattended share | `/demo/work` panel 6, `execution_mode` control | Per-Member, on the profile |
| Fan-out | Agents per session (ADR-0008); tree on `/demo/history` | Machine allocation against wall clock as a panel |
| Heavy, token-light work | Priced into Cost | Token / machine split of Cost; arrives with BYOK (ADR-0010) |
| Who runs agents well | `/demo/people`, the comparator | Model mix on the profile |
| Learn the how | Template mix on the profile | Model mix, unattended share, tool calls, agent identity |
| The alternative's cost | — | Out of scope; § 3 says why |

## 6. The value proposition, in one paragraph

> A swarm of cloud agents is a batch system with a language model in it. It earns its cost when the
> work runs while nobody is watching, when one task is worth splitting across machines, when the job
> is heavier than a laptop, or when someone has to answer for the spend by issue and by person. For
> everything else a laptop is cheaper, and the difference is not the model but the accounting: a
> local agent leaves no row. This dashboard is the accounting. It prices every session, keys it to a
> person and an issue, counts it only when the work was accepted, and shows an engineering
> organisation, on its own data, how much of its agent work falls in the four cases that pay, what
> each finished task cost, and which of its people have found the way to run agents that the rest
> could learn from. It does not claim anyone ships more than before, because it cannot measure that,
> and it will not rank anyone, because two companies tried and the bill went up.

## Sources

- `.scratch/agent-dash/research/03-jtbd-and-demo.md` — jobs by vantage point; METR; Meyer et al.
- `.scratch/agent-dash/research/15-actionable-signal-landscape.md` § 2.1, § 3.5, § 8, § 9 — vendor
  value propositions, where the field ranks named engineers, the evidence, the gaps by audience.
- `docs/adr/0003-individual-visibility-is-open-by-default.md` — the Goodhart record and the position.
- `docs/adr/0008-a-child-session-rolls-up-into-its-root.md` — fan-out.
- `CONTEXT.md` § Duration spans, § Machine allocation, § Cost, § Seat cost.
- `docs/roadmap.md` — what is next, and the cuts.
