Type: implementation
Status: ready-for-agent
Blocked by: 21, 22
Label: ready-for-agent

# Aggregation: non-additive Team roll-ups and per-capita denominators

**Two of the four ADR-0005 replacement targets.** These had no owning ticket until now.

## Goal

`src/domain/aggregate.ts` — roll-ups across every dimension, handling the one non-additive level
correctly and computing per-capita denominators that exclude service accounts.

## Scope

**Non-additive Team roll-ups (R-V3).** Teams and Members are many-to-many, so Team is a containment
hierarchy, not a partition. There is no primary Team — one was proposed and rejected, because
GitHub teams overlap and a primary would be an invention.

- The sum of every Team's figure **exceeds** the Organization figure.
- A Member in two Teams contributes their **full** figure to both, not half to each.
- The **overlap note is computed alongside the total**, in the same grouping pass, so they cannot
  disagree. It states the true count of multi-Team Members.
- Organization → Member and Model → family → tier **are** true partitions and do sum.

**Per-capita denominators (R-M14).** The denominator counts **active human Members only**. Service
accounts hold no seat and would give the denominator the wrong size.

- Service accounts still contribute to the **numerator** — their sessions are real work and real
  cost. Only the seat-holding denominator excludes them.
- Team per-capita uses that Team's human headcount, and an overlapping Member is counted in each
  Team's denominator as well as its numerator.
- Offered only where more than one Member is aggregated. Raw is the default.

## Done when

**T-U6** and **T-U7** pass, including the partition contrast cases.

## Notes

This is the single most likely place for the product to assert a wrong number confidently, which is
why ADR-0005 named it when it moved cost attribution upstream: *"the interesting failures in this
product are aggregation failures… pricing a session is multiplication."*

R-D14 guarantees at least 3 multi-Team Members, so the non-additive case is real rather than hoped
for. R-D3 puts 2 service accounts in 20 Members, so a wrong denominator is off by 10% — large
enough to catch, small enough that an eyeballed chart would not.
