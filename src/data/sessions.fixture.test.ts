// T-U24 and T-U25 against the **committed** fixture (`spec.md` R-M19, R-D21, ADR-0008, P6),
// ticket 48.
//
// The pure unit tests live in `src/domain/sessions.test.ts` and author every row inline, because
// `src/domain/**` may not reach the data layer (R-T5). This file sits outside that boundary, so it
// may import `load.ts` — and it exists because P6 says a test that would pass against an empty
// fixture is not a test. The claim it carries is the one the ticket was raised for, and it is only
// worth anything against rows that actually fan out: **the fan-out moves no Task-grain rate.**
//
// It reads committed output and never runs the generator (P3, R-T20).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decompositionRate, reworkRate, taskFacts } from "@/domain/metrics/efficacy";
import { agentsPerSession, rollUpSessions } from "@/domain/sessions";
import type { AgentSession, Repository, WorkType } from "@/domain/types";
import { loadDataset } from "./load";

const { sessions, childSessions, repositories, workTypes } = loadDataset();

/** The rows as stored, hidden ones included — the "before the fold" side of every claim below. */
const readRaw = <T>(name: string): T =>
  JSON.parse(
    readFileSync(join(process.cwd(), "src", "fixtures", "data", name), "utf8"),
  ) as T;

const storedRows: readonly AgentSession[] = repositories.flatMap((repository: Repository) =>
  workTypes.flatMap((workType: WorkType) =>
    readRaw<AgentSession[]>(join("sessions", `${repository.name}__${workType.key}.json`)),
  ),
);

const visibleRows = storedRows.filter((row) => !row.hidden);
const storedRoots = visibleRows.filter((row) => row.parent_session_id === null);
const storedChildren = visibleRows.filter((row) => row.parent_session_id !== null);
const totalCost = (rows: readonly AgentSession[]): number =>
  rows.reduce((running, row) => running + row.cost, 0);

describe("T-U24 — the committed fixture fans out, and the fold loses nothing (R-D21)", () => {
  it("holds a child fan-out under a fifth of its 7,761 visible roots", () => {
    // The **root** count is the schedule's and stays literal. The child count is a draw of one
    // to four per fanned-out root, so it is derived from the rows rather than written down —
    // ticket 67 changed the WorkType mix under it, and the fan-out is weighted by WorkType.
    expect(sessions).toHaveLength(7761);
    expect(storedChildren).toHaveLength(visibleRows.length - storedRoots.length);
    expect(storedChildren.length).toBeGreaterThan(childSessions.size);
    expect(storedChildren.length).toBeLessThanOrEqual(4 * childSessions.size);
    expect(childSessions.size).toBe(Math.round(sessions.length * 0.2));
    // R-D21's share, over the population `children.mts` draws from.
    expect(childSessions.size / sessions.length).toBeCloseTo(0.2, 2);
  });

  it("gives each root its own cost plus its children's, and nobody else's", () => {
    for (const root of sessions) {
      const stored = storedRoots.find((row) => row.id === root.id);
      const children = childSessions.get(root.id) ?? [];
      expect(root.cost).toBeCloseTo((stored?.cost ?? 0) + totalCost(children), 8);
    }
  });

  it("keeps the Organization's session spend exactly what the rows on disk say", () => {
    // Nothing lost and nothing counted twice: the fold moves money between rows, never into or
    // out of the total. This is what makes "the headline changes only by the roll-up" checkable.
    expect(totalCost(sessions)).toBeCloseTo(totalCost(visibleRows), 6);
    expect(totalCost(sessions)).toBeGreaterThan(totalCost(storedRoots));
  });

  it("is already folded: rolling the loaded population up again changes nothing", () => {
    expect(rollUpSessions(sessions)).toEqual(sessions);
  });

  it("holds every child inside its root's window, so the wall clock is the attempt's", () => {
    for (const [rootId, children] of childSessions) {
      const root = sessions.find((row) => row.id === rootId);
      for (const child of children) {
        expect(Date.parse(child.started_at)).toBeGreaterThan(Date.parse(root?.started_at ?? ""));
        expect(Date.parse(child.ended_at)).toBeLessThan(Date.parse(root?.ended_at ?? ""));
      }
    }
  });
});

describe("T-U24 — the fan-out moves no Task-grain rate (R-M19, the whole ticket)", () => {
  const overRoots = taskFacts(sessions);
  const overEveryRow = taskFacts(visibleRows);

  it("reads the same Rework and Decomposition rates with the children handed straight in", () => {
    // The failure this ticket exists to fix: before the parent link, the second list below was
    // the only list, and every fan-out read as a failed session followed by another.
    expect(reworkRate(overEveryRow)).toEqual(reworkRate(overRoots));
    expect(decompositionRate(overEveryRow)).toEqual(decompositionRate(overRoots));
    expect(reworkRate(overRoots).rate).toBeCloseTo(0.18, 2);
    expect(decompositionRate(overRoots).rate).toBeCloseTo(0.12, 2);
  });

  it("counts the same Tasks, with the same session counts, on both populations", () => {
    expect(overEveryRow).toEqual(overRoots);
  });

  it("would read a much higher Rework rate if a child counted as an attempt", () => {
    // The counterfactual, computed rather than argued in prose: relabel every child as a root
    // and Rework goes from 18% to 30% on the same work. That twelve-point error is what the
    // parent link is worth, and it grows with how much a team fans out.
    const asAttempts = taskFacts(visibleRows.map((row) => ({ ...row, parent_session_id: null })));

    // The size of the error is derived rather than written down — it is a function of how much
    // the fixture fans out, and ticket 67 moved the WorkType mix the fan-out is weighted by.
    // What does not move is its *direction* and that it is worth double figures.
    expect(reworkRate(asAttempts).rate ?? 0).toBeGreaterThan(
      (reworkRate(overRoots).rate ?? 0) + 0.12,
    );
  });
});

describe("T-U25 — Agents per session over the committed fixture", () => {
  it("reads a median of one agent and a p95 of four", () => {
    expect(agentsPerSession(sessions, childSessions)).toEqual({
      sessions: 7761,
      // Roots plus everything they spawned — the row count on disk, less the hidden ones.
      agents: visibleRows.length,
      median: 1,
      p95: 4,
    });
  });

  it("counts every row on disk exactly once: agents are roots plus children", () => {
    expect(agentsPerSession(sessions, childSessions).agents).toBe(visibleRows.length);
  });
});
