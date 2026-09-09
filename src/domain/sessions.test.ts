// T-U24 and T-U25 — the session tree (`spec.md` R-M19, `CONTEXT.md` § Work, ADR-0008), ticket 48.
//
// Every row here is authored inline: this is `src/domain/**`, which may not reach the data layer
// (R-T5). The same claims are re-asserted over the committed fixture in
// `src/data/sessions.fixture.test.ts` (P6), because a rule proved only against rows a test wrote
// is a rule that can be true of nothing the product ships.
//
// The two failures this file exists to prevent are the two the ticket was raised for:
//
//   * a child counted as a **row**, which double-counts its cost and its tokens the moment its
//     root is counted too;
//   * a child counted as an **attempt**, which is what made every sub-agent fan-out read as
//     Rework — the Rework case itself lives in `metrics/efficacy.test.ts`, where the rate is.

import { describe, expect, it } from "vitest";
import {
  agentsPerSession,
  childFaults,
  childrenByRoot,
  isRootSession,
  rollUpSession,
  rollUpSessions,
} from "./sessions";
import type { AgentSession } from "./types";

const ROOT: AgentSession = {
  id: "ses_0001",
  parent_session_id: null,
  started_at: "2026-08-03T09:00:00+02:00",
  ended_at: "2026-08-03T11:00:00+02:00",
  member_id: "mem_asanchez",
  repository_id: "repo_api_gateway",
  work_type: "implementation",
  task_key: "equilibrio/api-gateway#412",
  execution_mode: "interactive",
  machine_spec: "general",
  accepted: true,
  hidden: false,
  prompt_count: 11,
  cost: 4,
  interactive_duration_s: 3000,
  idle_duration_s: 1800,
  afk_duration_s: 2400,
  machine_allocation_duration_s: 7200,
  artefacts: { pull_request: 1, commit: 3 },
  token_usage: [{ model_id: "claude-sonnet-5", uncached_input: 100, cache_read: 200, cache_write: 40, output: 60 }],
};

/** A child of `ROOT`: same five labels, no outcome, nested inside its root's window. */
const childOf = (id: string, over: Partial<AgentSession> = {}): AgentSession => ({
  ...ROOT,
  id,
  parent_session_id: ROOT.id,
  started_at: "2026-08-03T09:30:00+02:00",
  ended_at: "2026-08-03T10:00:00+02:00",
  accepted: false,
  prompt_count: 0,
  cost: 1,
  interactive_duration_s: 600,
  idle_duration_s: 300,
  afk_duration_s: 900,
  machine_allocation_duration_s: 1800,
  artefacts: {},
  token_usage: [{ model_id: "claude-sonnet-5", uncached_input: 10, cache_read: 20, cache_write: 4, output: 6 }],
  ...over,
});

describe("T-U24 — a child rolls into its root, and is a row nowhere (R-M19)", () => {
  const children = [childOf("ses_0002"), childOf("ses_0003"), childOf("ses_0004")];

  it("adds the children's cost to the root's own", () => {
    // The Done-when's arithmetic, stated as an identity rather than as a literal: the figure is
    // the tree's, and the tree is the root plus everything spawned under it.
    expect(rollUpSession(ROOT, children).cost).toBe(4 + 1 + 1 + 1);
  });

  it("sums the four duration fields together, so the spans still partition the allocation", () => {
    const rolled = rollUpSession(ROOT, children);

    expect(rolled.interactive_duration_s).toBe(3000 + 600 * 3);
    expect(rolled.idle_duration_s).toBe(1800 + 300 * 3);
    expect(rolled.afk_duration_s).toBe(2400 + 900 * 3);
    // R-T12 survives the fold because all four are summed, not three of them.
    expect(
      rolled.interactive_duration_s + rolled.idle_duration_s + rolled.afk_duration_s,
    ).toBe(rolled.machine_allocation_duration_s);
  });

  it("leaves the wall clock alone: a child runs inside its root's window", () => {
    const rolled = rollUpSession(ROOT, children);

    expect(rolled.started_at).toBe(ROOT.started_at);
    expect(rolled.ended_at).toBe(ROOT.ended_at);
    // The one place the two duration claims legitimately differ: two agents held two machines.
    expect(rolled.machine_allocation_duration_s).toBeGreaterThan(
      (Date.parse(rolled.ended_at) - Date.parse(rolled.started_at)) / 1000,
    );
  });

  it("folds TokenUsage per Model, so a shared Model is one row and not two", () => {
    const rolled = rollUpSession(ROOT, [
      childOf("ses_0002"),
      childOf("ses_0003", {
        token_usage: [{ model_id: "gpt-5-nano", uncached_input: 5, cache_read: 5, cache_write: 5, output: 5 }],
      }),
    ]);

    expect(rolled.token_usage).toEqual([
      { model_id: "claude-sonnet-5", uncached_input: 110, cache_read: 220, cache_write: 44, output: 66 },
      { model_id: "gpt-5-nano", uncached_input: 5, cache_read: 5, cache_write: 5, output: 5 },
    ]);
  });

  it("keeps the outcome, the prompts and the artefacts the root's own", () => {
    const rolled = rollUpSession(ROOT, children);

    expect(rolled.accepted).toBe(ROOT.accepted);
    expect(rolled.prompt_count).toBe(ROOT.prompt_count);
    expect(rolled.artefacts).toEqual(ROOT.artefacts);
    expect(rolled.parent_session_id).toBeNull();
  });

  it("returns the root itself where nothing was spawned", () => {
    expect(rollUpSession(ROOT, [])).toBe(ROOT);
  });

  it("returns roots only, and every child's figure is inside one of them", () => {
    const rows = [ROOT, ...children];
    const rolled = rollUpSessions(rows);

    expect(rolled.map((row) => row.id)).toEqual([ROOT.id]);
    expect(rolled.every(isRootSession)).toBe(true);
    // Nothing is lost and nothing is counted twice: the population's cost is unchanged.
    expect(rolled.reduce((running, row) => running + row.cost, 0)).toBe(
      rows.reduce((running, row) => running + row.cost, 0),
    );
  });

  it("counts a child whose root is not in the population nowhere at all", () => {
    // The same rule `aggregate.ts` applies to a row whose Member is not in the population. It is
    // a guarded impossibility — `load.ts` faults on an orphan — not a silent correction.
    expect(rollUpSessions(children)).toEqual([]);
  });

  it("groups children under the root that spawned them", () => {
    const grouped = childrenByRoot([ROOT, ...children]);

    expect(grouped.get(ROOT.id)?.map((row) => row.id)).toEqual(["ses_0002", "ses_0003", "ses_0004"]);
    expect(grouped.has("ses_0002")).toBe(false);
  });
});

describe("T-U24 — what makes a child well-formed is one expression", () => {
  it("passes a child that inherits its root's five labels and carries no outcome", () => {
    expect(childFaults(childOf("ses_0002"), ROOT)).toEqual([]);
  });

  it("names the root that is not there", () => {
    expect(childFaults(childOf("ses_0002"), undefined)).toEqual(["parent-missing"]);
  });

  it("refuses a grandchild: a child's parent is always a root", () => {
    const child = childOf("ses_0002");
    const grandchild = { ...childOf("ses_0003"), parent_session_id: child.id };

    expect(childFaults(grandchild, child)).toEqual(["parent-is-not-a-root"]);
  });

  it("refuses a child that disagrees with any of the five inherited labels", () => {
    for (const disagreement of [
      { member_id: "mem_other" },
      { repository_id: "repo_web_console" },
      { work_type: "review" } as const,
      { task_key: "equilibrio/api-gateway#999" },
      { execution_mode: "headless" } as const,
    ]) {
      expect(childFaults(childOf("ses_0002", disagreement), ROOT)).toEqual(["labels-disagree"]);
    }
  });

  it("refuses a child carrying `accepted`: acceptance is the attempt's, and the root holds it", () => {
    expect(childFaults(childOf("ses_0002", { accepted: true }), ROOT)).toEqual(["child-is-accepted"]);
  });

  it("refuses a visible child under a hidden root, whose cost would roll up into nothing", () => {
    expect(childFaults(childOf("ses_0002"), { ...ROOT, hidden: true })).toEqual(["parent-hidden"]);
    // A hidden root taking its children with it is not a fault — it is R-M2 working.
    expect(childFaults(childOf("ses_0002", { hidden: true }), { ...ROOT, hidden: true })).toEqual([]);
  });
});

describe("T-U25 — Agents per session, median and p95 (R-M19)", () => {
  const rootAt = (id: string): AgentSession => ({ ...ROOT, id });

  it("counts a root that spawned nothing as one agent, not none", () => {
    const roots = [rootAt("ses_0001"), rootAt("ses_0005")];

    expect(agentsPerSession(roots, childrenByRoot(roots))).toEqual({
      sessions: 2,
      agents: 2,
      median: 1,
      p95: 1,
    });
  });

  it("reads the fan-out at both order statistics", () => {
    const roots = Array.from({ length: 10 }, (_, at) => rootAt(`ses_${at}`));
    const children = [
      { ...childOf("ses_c1"), parent_session_id: "ses_9" },
      { ...childOf("ses_c2"), parent_session_id: "ses_9" },
      { ...childOf("ses_c3"), parent_session_id: "ses_9" },
      { ...childOf("ses_c4"), parent_session_id: "ses_8" },
    ];
    const reading = agentsPerSession(roots, childrenByRoot([...roots, ...children]));

    expect(reading).toEqual({ sessions: 10, agents: 14, median: 1, p95: 4 });
  });

  it("has no reading over no sessions — an absence, never a zero (R-M18)", () => {
    expect(agentsPerSession([], new Map())).toEqual({
      sessions: 0,
      agents: 0,
      median: null,
      p95: null,
    });
  });
});
