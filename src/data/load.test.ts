// Boundary 1 under test — the load fault model, the per-process cache, and T-U5.
//
// These read the *committed* fixture and never run the generator (R-T20): a test that
// regenerates its own input tests the generator, not the data the application will load.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentSession, Membership, Repository, WorkType } from "@/domain/types";
import * as loadModule from "./load";
import { loadDataset, readDataset, readFixtureFile, type Dataset, type FixtureReader } from "./load";
import { FixtureFault } from "./schema";

const DATA_DIRECTORY = join(process.cwd(), "src", "fixtures", "data");

const readRaw = <T>(name: string): T =>
  JSON.parse(readFileSync(join(DATA_DIRECTORY, name), "utf8")) as T;

const rawRepositories = readRaw<Repository[]>("repositories.json");
const rawWorkTypes = readRaw<WorkType[]>("work_types.json");

const sessionFiles = rawRepositories.flatMap((repository) =>
  rawWorkTypes.map((workType) => join("sessions", `${repository.name}__${workType.key}.json`)),
);

/** Every session row on disk, hidden ones included. This is the "without the filter" side. */
const rawSessions = sessionFiles.flatMap((file) => readRaw<AgentSession[]>(file));
const hiddenRows = rawSessions.filter((row) => row.hidden);
/** What the loader returns one of: a visible **root** (R-M19). Children fold into these. */
const visibleRoots = rawSessions.filter((row) => !row.hidden && row.parent_session_id === null);
const rawChildren = rawSessions.filter((row) => row.parent_session_id !== null);

/** Mirrors the production reader, so an override test differs from production in one file only. */
const fixtureReader: FixtureReader = (path) => readFileSync(join(DATA_DIRECTORY, path), "utf8");

const readerWith = (overrides: Readonly<Record<string, string>>): FixtureReader => {
  return (path) => overrides[path] ?? fixtureReader(path);
};

const readerWithout = (absent: string): FixtureReader => {
  return (path) => {
    if (path === absent) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    return fixtureReader(path);
  };
};

const sessionsIn = (file: string): AgentSession[] => readRaw<AgentSession[]>(file);

const withFirstRow = (file: string, mutate: (row: AgentSession) => void): string => {
  const rows = sessionsIn(file);
  const [first] = rows;
  if (first === undefined) throw new Error(`${file} is empty; pick a populated pair`);
  mutate(first);
  return JSON.stringify(rows);
};

const POPULATED_PAIR = join("sessions", "api-gateway__implementation.json");
const EMPTY_PAIR = join("sessions", "mobile-app__deploy.json");

describe("readDataset", () => {
  const dataset = readDataset();

  it("parses every committed file into typed rows", () => {
    expect(dataset.organization.slug).toBe("demo");
    expect(dataset.repositories).toHaveLength(rawRepositories.length);
    expect(dataset.workTypes).toHaveLength(rawWorkTypes.length);
    expect(dataset.members.length).toBeGreaterThan(0);
    expect(dataset.githubUsers).toHaveLength(dataset.members.length);
    expect(dataset.teams.length).toBeGreaterThan(0);
    expect(dataset.tasks.length).toBeGreaterThan(0);
    expect(dataset.models.length).toBeGreaterThan(0);
    expect(dataset.rateCards.token.rates).toHaveLength(dataset.models.length);
  });

  it("reads one file per (repository × work_type) pair, all 25 of them (R-D19)", () => {
    const onDisk = readdirSync(join(DATA_DIRECTORY, "sessions")).sort();
    expect(sessionFiles).toHaveLength(25);
    expect(onDisk).toEqual(sessionFiles.map((file) => file.replace("sessions/", "")).sort());
  });

  it("accepts an empty pair — `[]` is a legitimate state, an absent file is not", () => {
    expect(sessionsIn(EMPTY_PAIR)).toEqual([]);
    expect(dataset.sessions.some((row) => row.work_type === "deploy")).toBe(true);
  });

  it("returns the sessions in one time-ordered list", () => {
    const startedAt = dataset.sessions.map((row) => Date.parse(row.started_at));
    expect(startedAt).toEqual([...startedAt].sort((left, right) => left - right));
  });

  it("orders sessions that started in the same instant by id, so the list is deterministic", () => {
    // A root: replacing the file with two copies of a *child* would leave both naming a parent
    // the override deleted, which is the fault the tree check exists for (R-M19).
    const [template] = sessionsIn(POPULATED_PAIR).filter(
      (row) => !row.hidden && row.parent_session_id === null,
    );
    if (template === undefined) throw new Error("expected a populated pair");
    const sameInstant = [
      { ...template, id: "ses_zzz9" },
      { ...template, id: "ses_zzz1" },
    ];
    const ordered = readDataset(readerWith({ [POPULATED_PAIR]: JSON.stringify(sameInstant) }));
    const ids = ordered.sessions
      .filter((row) => row.started_at === template.started_at)
      .map((row) => row.id);
    expect(ids).toEqual(["ses_zzz1", "ses_zzz9"]);
  });

  it("reads `cost` off the row rather than deriving it (R-T11 / R-M4)", () => {
    const fannedOut = new Set(rawChildren.map((row) => row.parent_session_id));
    const alone = visibleRoots.find((row) => !fannedOut.has(row.id));
    const loaded = dataset.sessions.find((row) => row.id === alone?.id);
    expect(loaded?.cost).toBe(alone?.cost);
  });

  it("adds a root's children into its cost, and adds nothing else (R-M19)", () => {
    const parent = rawChildren[0]?.parent_session_id;
    const root = visibleRoots.find((row) => row.id === parent);
    const children = rawChildren.filter((row) => row.parent_session_id === parent);
    const loaded = dataset.sessions.find((row) => row.id === parent);

    expect(children.length).toBeGreaterThan(0);
    expect(loaded?.cost).toBeCloseTo(
      (root?.cost ?? 0) + children.reduce((total, row) => total + row.cost, 0),
      8,
    );
    // The wall clock is the root's: a child runs inside its root's window.
    expect(loaded?.started_at).toBe(root?.started_at);
    expect(loaded?.ended_at).toBe(root?.ended_at);
  });

  it("returns roots only, and hands the child rows over separately (R-M19)", () => {
    expect(dataset.sessions.every((row) => row.parent_session_id === null)).toBe(true);
    expect(dataset.sessions).toHaveLength(visibleRoots.length);
    expect([...dataset.childSessions.values()].flat()).toHaveLength(rawChildren.length);
    for (const [parentId, children] of dataset.childSessions) {
      expect(dataset.sessions.some((row) => row.id === parentId)).toBe(true);
      for (const child of children) expect(child.parent_session_id).toBe(parentId);
    }
  });

  it("carries `accepted` as the only outcome field (R-M3)", () => {
    const outcomeFields = Object.keys(dataset.sessions[0] ?? {}).filter((key) =>
      /accept|status|outcome|complete/i.test(key),
    );
    expect(outcomeFields).toEqual(["accepted"]);
  });
});

describe("a malformed or missing fixture is a fault, not a valid state", () => {
  it("wraps an unreadable file in a FixtureFault naming R-D19", () => {
    expect(() => readFixtureFile(join("sessions", "web-console__nonexistent.json"))).toThrow(FixtureFault);
    expect(() => readFixtureFile(join("sessions", "web-console__nonexistent.json"))).toThrow(/R-D19/);
  });

  it("refuses to build a dataset when a session file is absent", () => {
    expect(() => readDataset(readerWithout(EMPTY_PAIR))).toThrow(/ENOENT/);
  });

  it("rejects a file that is not JSON", () => {
    expect(() => readDataset(readerWith({ [POPULATED_PAIR]: "{ not json" }))).toThrow(FixtureFault);
    expect(() => readDataset(readerWith({ "models.json": "" }))).toThrow(/not valid JSON/);
  });

  it("rejects a wrong primitive type", () => {
    const payload = withFirstRow(POPULATED_PAIR, (row) => {
      Object.assign(row, { cost: "10.29" });
    });
    expect(() => readDataset(readerWith({ [POPULATED_PAIR]: payload }))).toThrow(
      /cost: expected a finite number, received string/,
    );
  });

  it("rejects a value outside a closed vocabulary", () => {
    const payload = withFirstRow(POPULATED_PAIR, (row) => {
      Object.assign(row, { machine_spec: "quantum" });
    });
    expect(() => readDataset(readerWith({ [POPULATED_PAIR]: payload }))).toThrow(
      /machine_spec: expected one of general \| compute \| memory \| storage/,
    );
  });

  it("rejects a row filed under the wrong (repository × work_type) pair", () => {
    const payload = withFirstRow(POPULATED_PAIR, (row) => {
      Object.assign(row, { repository_id: "repo_mobile_app" });
    });
    expect(() => readDataset(readerWith({ [POPULATED_PAIR]: payload }))).toThrow(/wrong pair/);
  });

  it("rejects a duplicated session id, which would double-count every measure it carries", () => {
    const rows = sessionsIn(POPULATED_PAIR).filter((row) => !row.hidden);
    const [first] = rows;
    expect(first).toBeDefined();
    const payload = JSON.stringify([...rows, first]);
    expect(() => readDataset(readerWith({ [POPULATED_PAIR]: payload }))).toThrow(/duplicate session id/);
  });

  it("rejects an artefact kind that is not in the vocabulary", () => {
    const payload = withFirstRow(POPULATED_PAIR, (row) => {
      Object.assign(row, { artefacts: { deployment: 1 } });
    });
    expect(() => readDataset(readerWith({ [POPULATED_PAIR]: payload }))).toThrow(/artefacts key/);
  });
});

describe("R-M19 — a child that disagrees with its root is a fault, not a row to drop", () => {
  /** The pair holds both roots and children, so a mutation here is read in context. */
  const withChild = (mutate: (child: AgentSession, rows: AgentSession[]) => void): string => {
    const rows = sessionsIn(POPULATED_PAIR);
    const child = rows.find((row) => row.parent_session_id !== null);
    if (child === undefined) throw new Error(`${POPULATED_PAIR} holds no child session`);
    mutate(child, rows);
    return JSON.stringify(rows);
  };

  /** The read, as a thunk, so each test states both halves of its own claim. */
  const readingOf = (payload: string) => (): Dataset =>
    readDataset(readerWith({ [POPULATED_PAIR]: payload }));

  it("rejects a child naming a root that is not in the fixture", () => {
    const read = readingOf(
      withChild((child) => {
        Object.assign(child, { parent_session_id: "ses_9999" });
      }),
    );

    expect(read).toThrow(FixtureFault);
    expect(read).toThrow(/parent-missing/);
  });

  it("rejects a grandchild: the tree is one level deep", () => {
    const read = readingOf(
      withChild((child) => {
        Object.assign(child, { parent_session_id: child.id });
      }),
    );

    expect(read).toThrow(FixtureFault);
    expect(read).toThrow(/parent-is-not-a-root/);
  });

  it("rejects a child that does not inherit one of the five labels", () => {
    const read = readingOf(
      withChild((child) => {
        Object.assign(child, { member_id: "mem_ngallego" });
      }),
    );

    expect(read).toThrow(FixtureFault);
    expect(read).toThrow(/labels-disagree/);
  });

  it("rejects a child carrying `accepted`, which belongs to the attempt and so to the root", () => {
    const read = readingOf(
      withChild((child) => {
        Object.assign(child, { accepted: true });
      }),
    );

    expect(read).toThrow(FixtureFault);
    expect(read).toThrow(/child-is-accepted/);
  });

  it("rejects a visible child under a hidden root, whose cost would roll up into nothing", () => {
    const read = readingOf(
      withChild((child, rows) => {
        const parent = rows.find((row) => row.id === child.parent_session_id);
        Object.assign(parent ?? {}, { hidden: true });
      }),
    );

    expect(read).toThrow(FixtureFault);
    expect(read).toThrow(/parent-hidden/);
  });
});

describe("the dataset is parsed once per process", () => {
  it("returns the identical object on every call", () => {
    expect(loadDataset()).toBe(loadDataset());
  });

  it("caches rather than memoises a shape — an uncached read is a fresh, equal dataset", () => {
    const fresh = readDataset();
    expect(fresh).not.toBe(loadDataset());
    expect(fresh.sessions).toEqual(loadDataset().sessions);
  });
});

// ---------------------------------------------------------------------------------------
// T-U5 — the hidden-session filter (R-M2, A4). Two halves, both asserted below:
//   (a) the same query over the same rows returns different counts with and without it;
//   (b) there is no code path that returns a hidden row.
// ---------------------------------------------------------------------------------------

/** One query, run twice: once over the rows on disk, once over the rows the loader returns. */
const countByWorkType = (rows: readonly AgentSession[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.work_type] = (counts[row.work_type] ?? 0) + 1;
  return counts;
};

const totalCost = (rows: readonly AgentSession[]): number =>
  rows.reduce((total, row) => total + row.cost, 0);

/**
 * Walks an arbitrary value graph looking for a session row. Deliberately structural: it does
 * not know what a Dataset looks like, so it keeps working when the shape grows.
 */
const holdsHiddenRow = (value: unknown, seen: Set<object>): boolean => {
  if (typeof value !== "object" || value === null || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => holdsHiddenRow(entry, seen));
  const record = value as Record<string, unknown>;
  if (record.hidden === true) return true;
  return Object.values(record).some((entry) => holdsHiddenRow(entry, seen));
};

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [path] : [];
  });

describe("T-U5 — hidden sessions are stripped once, at load (R-M2)", () => {
  const dataset: Dataset = loadDataset();

  it("has hidden sessions in the fixture for the rule to act on (R-D12)", () => {
    expect(hiddenRows.length).toBeGreaterThan(0);
    expect(hiddenRows.length / rawSessions.length).toBeLessThan(0.05);
  });

  // (a) The same query, the same rows, different answers.
  it("answers the same query differently with the filter than without it", () => {
    expect(countByWorkType(dataset.sessions)).not.toEqual(countByWorkType(rawSessions));
    // R-M19 — the loader returns roots, so the row count is the visible roots' and the *cost*
    // is every visible row's: a child is not a row here, and its money is still in the total.
    expect(dataset.sessions).toHaveLength(visibleRoots.length);
    expect(totalCost(dataset.sessions)).toBeLessThan(totalCost(rawSessions));
    expect(totalCost(rawSessions) - totalCost(dataset.sessions)).toBeCloseTo(totalCost(hiddenRows), 6);
  });

  it("drops exactly the hidden rows and keeps every other one", () => {
    const kept = new Set([
      ...dataset.sessions.map((row) => row.id),
      ...[...dataset.childSessions.values()].flat().map((row) => row.id),
    ]);
    expect(kept.size).toBe(rawSessions.length - hiddenRows.length);
    for (const row of hiddenRows) expect(kept.has(row.id)).toBe(false);
    for (const row of rawSessions.filter((candidate) => !candidate.hidden)) {
      expect(kept.has(row.id)).toBe(true);
    }
  });

  // (b) No code path returns a hidden row. The detector is proved on the raw rows first,
  // so a broken walker cannot make the assertions below vacuous.
  it("detects a hidden row when one is present — the control for the assertions below", () => {
    expect(holdsHiddenRow(rawSessions, new Set())).toBe(true);
    expect(holdsHiddenRow(dataset, new Set())).toBe(false);
  });

  it("exposes no exported code path that returns a hidden row", () => {
    const exported = Object.entries(loadModule).filter(([, value]) => typeof value === "function");
    // The whole runtime surface of the boundary. A new export lands here and must be judged.
    expect(exported.map(([name]) => name).sort()).toEqual([
      "loadDataset",
      "readDataset",
      "readFixtureFile",
    ]);

    // `readFixtureFile` hands back file text, not rows; the two dataset paths are the ones
    // that could leak, and neither does.
    expect(holdsHiddenRow(loadDataset(), new Set())).toBe(false);
    expect(holdsHiddenRow(readDataset(), new Set())).toBe(false);
    expect(holdsHiddenRow(readDataset(fixtureReader), new Set())).toBe(false);
    expect(typeof readFixtureFile("organization.json")).toBe("string");
  });

  it("offers no parameter that could switch the exclusion off", () => {
    // `loadDataset()` takes nothing; `readDataset(reader)` takes a reader and nothing else.
    // An `includeHidden` flag cannot be added without failing one of these.
    expect(loadDataset).toHaveLength(0);
    expect(readDataset).toHaveLength(0); // one optional parameter, so arity is still 0
    expect(readDataset(readerWith({}))).toEqual(readDataset());
  });

  it("still strips hidden rows when the reader hands it a fixture full of them", () => {
    const rows = sessionsIn(POPULATED_PAIR).map((row) => ({ ...row, hidden: true }));
    const dosed = readDataset(readerWith({ [POPULATED_PAIR]: JSON.stringify(rows) }));
    expect(holdsHiddenRow(dosed, new Set())).toBe(false);
    expect(dosed.sessions).toHaveLength(dataset.sessions.length - countOf(POPULATED_PAIR, dataset));
  });

  it("is the only place in the application that touches the field", () => {
    // A per-query filter is a filter somebody forgets. If `hidden` starts being read
    // somewhere else, that is a decision, and this test is where it gets made.
    const mentions = sourceFiles(join(process.cwd(), "src"))
      .filter((path) => !path.includes(join("src", "fixtures")))
      .filter((path) => /\.hidden\b|\bhidden\s*:/.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(process.cwd().length + 1))
      .sort();

    expect(mentions).toEqual([
      join("src", "data", "load.ts"), // strips them, once
      join("src", "data", "schema.ts"), // validates the field the fixture carries
      // R-M19 — `childFaults` reads it to refuse a *visible* child of a hidden root, whose
      // cost would roll up into a row the strip had already removed. It reads the field to
      // enforce the strip, which is the one other reason to read it.
      join("src", "domain", "sessions.ts"),
      // Ticket 51 — the property generators *write* the field and never read it: every row they
      // build carries `hidden: false`, because the population a property is stated over is the
      // one the strip has already run on. A generator able to emit a hidden row would be handing
      // the domain layer rows the application never sees.
      join("src", "domain", "testing", "sessions.ts"),
      join("src", "domain", "types.ts"), // declares it
    ]);
  });
});

function countOf(file: string, dataset: Dataset): number {
  const ids = new Set(sessionsIn(file).map((row) => row.id));
  return dataset.sessions.filter((row) => ids.has(row.id)).length;
}

/**
 * **Ticket 58 — tenancy is validated at load, in the file that states it.**
 *
 * Every fault here names the file, the row index and the field (T-U26): a Membership is the row
 * that decides who may read an Organization's data, so "which one" is the first thing a reader
 * needs and the last thing they should have to grep for.
 */
describe("memberships.json — the Member↔Organization join is validated at load", () => {
  const rawMemberships = readRaw<Membership[]>("memberships.json");

  it("resolves every committed Membership to the seeded Organization and a real Member", () => {
    const dataset = readDataset(fixtureReader);
    const memberIds = new Set(dataset.members.map((member) => member.id));

    expect(dataset.memberships).toHaveLength(dataset.members.length);
    expect(
      dataset.memberships.every(
        (membership) =>
          membership.organization_id === dataset.organization.id &&
          memberIds.has(membership.member_id),
      ),
    ).toBe(true);
  });

  it("faults on a Membership naming an Organization nothing declares", () => {
    const payload = JSON.stringify([
      ...rawMemberships,
      { organization_id: "org_nowhere", member_id: rawMemberships[0]?.member_id, role: "member" },
    ]);

    expect(() => readDataset(readerWith({ "memberships.json": payload }))).toThrow(FixtureFault);
    // File, row and field — all three, which is what makes the fault openable.
    expect(() => readDataset(readerWith({ "memberships.json": payload }))).toThrow(
      new RegExp(`memberships\\.json\\[${String(rawMemberships.length)}\\]\\.organization_id`),
    );
    expect(() => readDataset(readerWith({ "memberships.json": payload }))).toThrow(
      /unknown Organization "org_nowhere"/,
    );
  });

  it("faults on a Membership naming a Member the directory does not hold", () => {
    const payload = JSON.stringify([
      ...rawMemberships,
      { organization_id: "org_equilibrio", member_id: "mem_ghost", role: "member" },
    ]);

    expect(() => readDataset(readerWith({ "memberships.json": payload }))).toThrow(
      new RegExp(`memberships\\.json\\[${String(rawMemberships.length)}\\]\\.member_id`),
    );
    expect(() => readDataset(readerWith({ "memberships.json": payload }))).toThrow(
      /unknown Member "mem_ghost"/,
    );
  });

  it("faults on two Memberships for one Member in one Organization", () => {
    const first = rawMemberships[0];
    const payload = JSON.stringify([...rawMemberships, { ...first, role: "contractor" }]);

    expect(() => readDataset(readerWith({ "memberships.json": payload }))).toThrow(
      /duplicate Membership/,
    );
  });

  it("faults on a Membership row that is not shaped like one", () => {
    const payload = JSON.stringify([{ organization_id: "org_equilibrio", member_id: 7 }]);

    expect(() => readDataset(readerWith({ "memberships.json": payload }))).toThrow(FixtureFault);
  });
});
