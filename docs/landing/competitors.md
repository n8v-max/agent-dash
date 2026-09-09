# Who the competitors actually are, and what to steal from the top three

Status: 2026-09-10, for ticket 59. Sources are the repo's own briefs (01, 02, 15 under
`.scratch/agent-dash/research/`) plus a web pass on current positioning and reviews on 2026-09-10.
Vendor marketing is labelled as such; review sentiment comes from G2, Gartner Peer Insights and
practitioner write-ups and is summarised, not quoted at length.

## 1. The competitive set, from the buyer's chair

The buyer is a VP of Engineering who has an agent platform and is asked what the spend returned. They
look in three places, and only two of them compete with this dashboard:

| Set | Who | What they own | Where they stop |
|---|---|---|---|
| **Native analytics of an agent platform** | Zencoder Analytics + Zenflow EM dashboard, Claude Code Analytics, Cursor Team Analytics, GitHub Copilot impact dashboard, Devin | the attempt: session, tokens, model, spend, per named user | lines accepted and PRs touched; no outcome per attempt, no cost per outcome, no rework |
| **The measurement layer** | Jellyfish AI Impact, DX AI Measurement Framework, Faros AI, LinearB | delivery outcomes across every tool: cycle time, allocation, DORA, surveys | cannot see inside an attempt; ingests vendor usage APIs, so it inherits their gaps; ROI is a calculator over supplied assumptions |
| **FinOps and gateways** | Vantage, CloudZero, Portkey, LiteLLM | the invoice and the token | not the VP's tool; the CFO's |

This product sits in the first set with the second set's question. That is the whole positioning
opportunity: `[E]` brief 15 § 9 G3 found no native platform that reports cost per completed unit of
work, and the measurement layer's own reviewers say it cannot attribute at the commit or attempt.

**Zencoder is in the set, twice.** It set the assignment (`docs/assignment.md`), so its analytics is
the incumbent this dashboard would extend, and its Zenflow EM dashboard is the closest thing any
native vendor has to a leader-facing view. It is competitor and host at once, which is why it is
first below.

## 2. The top three, on positioning and reviews

### Zencoder — Analytics, Quota Management, and the Zenflow Engineering Manager dashboard

**Positioning, verbatim.** *"AI orchestration for code and work. One subscription. Every frontier
model. The right one for every task. Better quality, lower cost, no vendor lock-in."* Analytics:
*"Track usage patterns and monitor team engagement."* Best practices name **"Reallocate seats — move
unused seats to active teams based on actual usage"** and **"Set baselines so anomalies are
visible."** Manager dashboard: *"Every metric is team-level. The dashboard never reports on
individuals"* and *"The $100K analytics stack you don't need."* (brief 15 § 2.1, § 5.3)

**What the record says.** `[E]` Two surfaces that contradict each other: an Analytics table keyed on
email with Agent Messages, IDEs, Languages and Last Active, and a manager dashboard that refuses
individuals (brief 15 F4). `[E]` Credits live in Quota Management and activity in Analytics with no
documented join (brief 15 § 4.1), so spend and work are never on one page. `[E]` Credits carry a
cross-vendor multiplier table, 0.25× to 5×, which is a capability tier expressed as price (F6).

**What to steal.**
- *"The right one for every task"* is the model-mix lever stated as a promise. The dashboard is
  where that promise is checked: cost per completed Job by tier is the receipt for it.
- *"Reallocate seats"* is the only signal in the field with an unambiguous action attached (brief 15
  § 5.4). Card 2 should end with the verb.
- *"The $100K analytics stack you don't need"* is the attack on the measurement layer, and it is
  ours to make with a better argument: the measurement layer sees that agents were used; the
  platform sees what each attempt cost and whether it was accepted.
- The gap to close is the missing join: spend and work on one page is the one thing Zencoder's own
  surfaces do not do.

### Anthropic — Claude Code Analytics and the Enterprise Value tab

The assignment names Claude Code on the Web as the model platform, so this is the reference native
dashboard.

**Positioning, verbatim.** *"Understand developer usage patterns, track contribution metrics, and
measure how Claude Code impacts engineering velocity."* The Value tab *"estimates productivity lift,
cost per commit, and annual value, with every formula visible in the tab and inputs adjustable."*
Contribution metrics are *"deliberately conservative and represent an underestimate."* Purpose lines:
*"Use contribution metrics to demonstrate ROI, identify adoption patterns, and find team members who
can help others get started"*; the Leaderboard *"helps you find team members with high adoption who
can share prompting techniques and workflows."* Charts: PRs with vs without Claude Code, PRs per user
over time, top-10 leaderboard with full CSV export. Console spend figures are *"estimates for
analytics purposes."*

**What the record says.** `[E]` The Enterprise Analytics API's `user_cost_report` sorts by spend
descending by default and `user_usage_report` is documented as *"see which users consume the most
tokens"* (brief 15 F2). Practitioner and vendor write-ups converge on the same three gaps: cost
attribution, cross-tool visibility, and tying usage to outcomes. `[E]` The one lift estimate in the
field that shows its formula is still a calculator over operator-supplied inputs (brief 15 § 5.4
item 5).

**What to steal.**
- **Show the arithmetic.** *"Every formula visible, inputs adjustable"* is the most trusted line in
  the field. Each card should carry its numerator and denominator in plain sight: $2,144 ÷ 150 Jobs.
- **"Deliberately conservative."** Failed attempts in the numerator is the same move; name it as
  *conservative by construction* rather than leaving the reader to infer it.
- **"Find team members who can help others get started."** This is the sanctioned wording for
  named visibility across the whole field, and it is card 4's sentence.
- **With vs without** is the counterfactual buyers want and the one this product refuses. The
  Repository × template grid is the honest substitute: the same agents, conditioned on the work.

### Jellyfish — AI Impact

The G2 category leader for seventeen quarters, and the product a VP is most likely to be shown as
the alternative to trusting a native dashboard.

**Positioning, verbatim.** *"In 2026 engineering leaders are shifting from AI adoption to AI
accountability."* *"An aggregate, system-level view of their AI investments – one that helps them
measure progress, manage change, and understand how AI is actually impacting engineering
efficiency."* The attack line is a whole page: *"What Jellyfish AI Impact delivers that native
dashboards can't"*: adoption across all tools in one place, side-by-side tool comparison, AI usage
enriched with delivery and flow metrics.

**What reviews say.** Praised for visibility, integrations, and an effort-based allocation model
leadership trusts. The recurring complaints: AI Impact data cannot be exported; data is *"difficult
to understand and act on"*; leaders receive *"executive dashboards without the clear, prescriptive
guidance needed to change team behavior"*; and neither Jellyfish nor its peers can identify which
commits contain AI contributions or track their quality afterwards.

**What to steal.**
- **The word.** *Accountability* is the 2026 buyer vocabulary, and it is exactly what a unit cost
  with every attempt in it delivers. The hero should carry it.
- **Invert the attack line.** Jellyfish says native dashboards cannot connect usage to outcomes.
  This dashboard is native and does, at the attempt: it is the one place the outcome and the cost
  of the same session sit on one row. *What the measurement layer can't see* is the counter-page.
- **Their reviewers' complaint is the design brief.** Prescriptive, not descriptive: every card ends
  in a verb.

## 3. Notable, not top three

- **Cursor Team Analytics.** Usage Leaderboard visible to every member, Repository Insights with AI
  share of committed code, Organizations (June 2026) reframing the enterprise pitch around *control*.
  Practitioner guidance already warns that the leaderboard becomes *"a social object"* and must be
  kept out of performance conversations. Steal: nothing on copy; note that the market's largest
  install base ships a leaderboard and the guidance around it is defensive.
- **GitHub Copilot impact dashboard.** Added a *"Potential return on investment"* section on
  2026-08-07: cost per developer, PR output, merge-rate signals, explicitly *"not a financial audit."*
  Steal: the disclaimer's honesty; note that even GitHub now leads with cost per developer, which is
  the numerator without the denominator.
- **DX AI Measurement Framework.** Utilization → Impact → Cost, framed as the buyer's maturity
  journey. Reviews praise the AI utilization and impact reports and complain about stale data and
  team-configuration toil. Steal: the journey, because our buyer is at the Cost stage and the page
  should not spend words on Utilization.
- **Faros AI.** *"Reduce your cost per outcome shipped"* and *"ROI for the CFO conversation."* The
  closest positioning to ours, from the measurement side. Reviews: strong centralisation, slow
  dashboards, customisation behind support tickets. Steal: the CFO framing of card 1.

## 4. What this changes in Shape C

Five edits, each traceable to a line above:

1. **Hero carries "accountability".** *What your agents cost per finished Job. Accountability for the
   agent bill: where it converts, where it leaks, and who has it figured out.*
2. **Every card shows its arithmetic.** A small line under the hero figure on each card: `$2,144 ÷
   150 completed Jobs`; `$4,212 of $9,117`; `session cost ÷ completed Jobs per cell`; `Team cost ÷
   Team completed Jobs`. Anthropic's formula-visible move, without the lift estimate.
3. **Every card ends in a verb.** Defend · Reclaim · Redirect · Spread. Jellyfish's reviewers asked
   for prescription; Zencoder's best practices show what one looks like.
4. **One line under the cards against the measurement layer.** *Usage dashboards see that agents ran.
   Delivery dashboards see what shipped. This is the one place the cost of an attempt and whether it
   was accepted sit on the same row.*
5. **"Conservative by construction"** replaces *"cannot be gamed by running more"* in card 1, which
   is the same claim in the field's own trusted wording.

Nothing here reopens the refused claim: no lift estimate, no with-versus-without, and none of the
words the smoke test forbids.

## Sources

Repo: `.scratch/agent-dash/research/15-actionable-signal-landscape.md` § 2.1, § 3.5, § 4.1, § 5.3,
§ 5.4, § 9; `docs/assignment.md`.

Web, 2026-09-10:
- [Claude Code docs — Track team usage with analytics](https://code.claude.com/docs/en/analytics)
- [Claude blog — New analytics and cost controls for Claude Enterprise](https://claude.com/blog/giving-admins-more-visibility-and-control-over-claude-usage-and-spend)
- [Jellyfish — AI Impact](https://jellyfish.co/platform/jellyfish-ai-impact/)
- [Jellyfish — What AI Impact delivers that native dashboards can't](https://jellyfish.co/blog/what-jellyfish-ai-impact-delivers-that-native-dashboards-cant/)
- [Jellyfish — From AI adoption to AI accountability](https://jellyfish.co/blog/2026-engineering-leaders-shifting-from-ai-adoption-to-ai-accountability/)
- [G2 — Jellyfish pros and cons](https://www.g2.com/products/jellyfish-2025-10-22/reviews?qs=pros-and-cons)
- [G2 — DX pros and cons](https://www.g2.com/products/dx-platform/reviews?qs=pros-and-cons)
- [G2 — Faros.ai pros and cons](https://www.g2.com/products/faros-ai/reviews?qs=pros-and-cons)
- [DX — AI Measurement Framework](https://getdx.com/whitepaper/ai-measurement-framework/)
- [Faros — Platform for AI leaders](https://www.faros.ai/ai-leaders)
- [Faros — AI coding ROI for the CFO conversation](https://www.faros.ai/blog/ai-coding-roi-for-the-cfo-conversation)
- [Cursor docs — Analytics](https://cursor.com/docs/account/teams/analytics)
- [Cursor Organizations, June 2026](https://www.digitalapplied.com/blog/cursor-organizations-enterprise-ai-coding-governance-2026)
- [GitHub Copilot ROI dashboard, August 2026](https://www.enhe-tech.com.cn/en/ai-news/github-copilot-roi-pr)
- [Zencoder docs — Analytics dashboard](https://docs.zencoder.ai/features/analytics)
- [Worklytics — Tracking Claude Code usage](https://www.worklytics.co/blog/tracking-claude-code-usage)
