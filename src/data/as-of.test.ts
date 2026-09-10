// **T-U35 — one slice, applied once** (R-D2, R-N3.1, A42, ticket 62).
//
// Two halves, and the second is the one worth the file.
//
// The first is the rule: `datasetAsOf(now)` is the committed fixture with every session that had
// not *finished* by `now` removed, children following their root, and the dataset itself returned
// where the cut removes nothing. Asserted over the committed rows (P6), at instants read off
// those rows rather than invented — so it fails against a fixture whose last day moved and could
// not pass against an empty one.
//
// The second is the absence, in the shape T-C19 asserts its own: **nothing under
// `src/data/queries/` and nothing under `src/app/` calls `loadDataset`**, and `datasetAsOf` is
// called in exactly two places. A behavioural test alone would pass against a product where one
// page query had quietly gone back to the whole dataset, because that query's rows are not the
// ones under test — and a query that reads the unsliced fixture is precisely the per-query filter
// somebody forgot, which is what `load.ts` line 14 says the boundary exists to prevent.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentSession } from "@/domain/types";
import { datasetAsOf } from "./as-of";
import { loadDataset } from "./load";

const committed = loadDataset();

/** Past every `ended_at` the fixture holds, so the slice has nothing to remove. */
const AFTER_EVERYTHING = "2099-01-01T00:00:00Z";

const endedAt = (row: AgentSession): number => Date.parse(row.ended_at);

/** A root that fanned out, taken from the middle of the window so both sides of it hold rows. */
const rootWithChildren = (): AgentSession => {
  const found = committed.sessions.find(
    (row) => (committed.childSessions.get(row.id)?.length ?? 0) > 0 && row.id !== "",
  );
  if (!found) throw new Error("the committed fixture holds no root with children (R-D21)");
  return found;
};

describe("T-U35 — `datasetAsOf` is the fixture cut at `now`", () => {
  const root = rootWithChildren();
  const children = committed.childSessions.get(root.id) ?? [];

  it("keeps a root that ended exactly at `now` — a session is observable at its end", () => {
    const kept = datasetAsOf(root.ended_at);

    expect(children.length).toBeGreaterThan(0); // the control: this root really did fan out
    expect(kept.sessions.map((row) => row.id)).toContain(root.id);
    expect(kept.childSessions.get(root.id)).toEqual(children);
  });

  it("drops a root that ended after `now`, and its children with it", () => {
    // One millisecond earlier: the only difference between the two reads is this root's own end,
    // so nothing but the fan-out rule can explain the children going too.
    const before = new Date(endedAt(root) - 1).toISOString();
    const cut = datasetAsOf(before);

    expect(cut.sessions.map((row) => row.id)).not.toContain(root.id);
    expect(cut.childSessions.has(root.id)).toBe(false);
  });

  it("removes every unfinished session and keeps every finished one, at any instant", () => {
    const at = new Date(endedAt(root)).toISOString();
    const cut = datasetAsOf(at);
    const expected = committed.sessions.filter((row) => endedAt(row) <= endedAt(root));

    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(committed.sessions.length);
    expect(cut.sessions).toEqual(expected);
  });

  it("keeps the fixture contract: no surviving child outlives the `now` its root survived", () => {
    // `sessions.fixture.test.ts` asserts `child.ended_at < root.ended_at` over the committed
    // tree; this is that invariant read through the slice, which is where it does its work —
    // a child ending after a root that ended before `now` would be a row in the fan-out of a
    // session the product claims to have fully observed.
    const cut = datasetAsOf(root.ended_at);
    const outliving = [...cut.childSessions.values()]
      .flat()
      .filter((child) => endedAt(child) > endedAt(root));

    expect([...cut.childSessions.values()].flat().length).toBeGreaterThan(0);
    expect(outliving).toEqual([]);
  });

  it("hands back the loaded dataset itself where the cut removes nothing", () => {
    // Until ticket 66 extends the window, this is the production case: the slice is a no-op and
    // is identically the memoised dataset, so no surface pays for a copy it does not need.
    expect(datasetAsOf(AFTER_EVERYTHING)).toBe(committed);
  });

  it("memoises per `now`, so a page's several queries share one slice", () => {
    expect(datasetAsOf(root.ended_at)).toBe(datasetAsOf(root.ended_at));
  });

  it("refuses a `now` that is not an instant rather than guessing which rows exist", () => {
    expect(() => datasetAsOf("yesterday")).toThrow(/not an ISO 8601 instant/);
  });
});

// --- The absence: one slice, and no second door -------------------------------------------------

const SOURCE_ROOT = join(process.cwd(), "src");

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [path] : [];
  });

/** The file's code with comment lines and trailing comments removed — prose is not a call. */
const codeOf = (path: string): string =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .map((line) => line.replace(/(^|[^:])\/\/.*/, "$1"))
    .join("\n");

const relative = (path: string): string => path.slice(process.cwd().length + 1);

const namingIn = (paths: readonly string[], name: RegExp): readonly string[] =>
  paths.filter((path) => name.test(codeOf(path))).map(relative).sort();

const LOAD_DATASET = /\bloadDataset\b/;
const DATASET_AS_OF = /\bdatasetAsOf\b/;

describe("T-U35 — the slice is applied once, and no query reaches around it (A42)", () => {
  const everything = sourceFiles(SOURCE_ROOT);

  it("sweeps a real source tree — the control for the absences below", () => {
    expect(everything.length).toBeGreaterThan(60);
    expect(namingIn(everything, LOAD_DATASET)).toContain(join("src", "data", "load.ts"));
  });

  it("names `loadDataset` in five modules, and every one of them is clock-free by nature", () => {
    // An allow-list rather than a ban, so a sixth caller is a decision somebody has to record
    // here. `clock.ts` reads the Organization to find the window's own end — the value `now` is
    // clamped *to*, so it cannot itself be taken as of `now`; `accounts.ts` and `viewer.ts` read
    // the directory and the memberships, which are identity and hold no session at all.
    expect(namingIn(everything, LOAD_DATASET)).toEqual(
      [
        join("src", "data", "accounts.ts"),
        join("src", "data", "as-of.ts"),
        join("src", "data", "clock.ts"),
        join("src", "data", "load.ts"),
        join("src", "data", "viewer.ts"),
      ].sort(),
    );
  });

  it("holds no module under `src/data/queries/` that names `loadDataset`", () => {
    const queries = sourceFiles(join(SOURCE_ROOT, "data", "queries"));

    expect(queries.length).toBeGreaterThan(8); // the control: the directory really was walked
    expect(namingIn(queries, LOAD_DATASET)).toEqual([]);
  });

  it("holds no page or component that names `loadDataset`", () => {
    const rendering = [
      ...sourceFiles(join(SOURCE_ROOT, "app")),
      ...sourceFiles(join(SOURCE_ROOT, "components")),
    ];

    expect(rendering.length).toBeGreaterThan(20);
    expect(namingIn(rendering, LOAD_DATASET)).toEqual([]);
  });

  it("takes the slice in two places under `queries/`, and both are once-per-page", () => {
    // `pageContext` is the page's one load and `controlOptions` is the toolbar's; every other
    // module under `queries/` is a projection of one of them, so a third caller here would be a
    // panel deciding for itself which rows exist.
    const queries = sourceFiles(join(SOURCE_ROOT, "data", "queries"));

    expect(namingIn(queries, DATASET_AS_OF)).toEqual(
      [
        join("src", "data", "queries", "context.ts"),
        join("src", "data", "queries", "controls.ts"),
      ].sort(),
    );
  });

  it("filters no query on `ended_at` — the cut is the slice's and nobody else's", () => {
    // The per-query filter this ticket exists to prevent, matched as the shape of a comparison
    // rather than as the bare field name: `ended_at` is read all over the product for durations
    // and for the as-of watermark, and reading it is not cutting on it.
    const above = everything.filter((path) => path !== join(SOURCE_ROOT, "data", "as-of.ts"));
    const cutting = namingIn(above, /ended_at\s*(<=|>=|<|>)|\bended_at\b[^\n]*\bnow\b/);

    expect(cutting).toEqual([]);
  });
});
