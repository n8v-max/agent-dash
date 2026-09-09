// T-U26 / T-U27 — the fixture contract (ticket 53).
//
// **Two claims, and they are the same claim from both ends.** A malformed upstream row must fail
// `load()` with a message that names the file, the row index and the field (T-U26), and `load()`
// must be the only way rows enter the application at all (T-U27). Either one alone is weak: a
// loader that faults loudly proves nothing if a panel can import the JSON beside it, and a
// boundary nothing bypasses proves nothing if it accepts a negative cost.
//
// P3 — the malformed rows are built **here**, as fixtures, from committed rows handed back
// through an overriding reader. Nothing on disk is mutated: the committed files are the input to
// every other test in the suite, and corrupting one would break them all rather than this.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { roleFor,
  sealViewer, type Viewer } from "@/domain/access";
import type { AgentSession, Model, Repository, WorkType } from "@/domain/types";
import { readDataset, type Dataset, type FixtureReader } from "./load";
import { defaultControls, type ControlSet } from "./params";
import { FixtureFault } from "./schema";

const SOURCE_ROOT = join(process.cwd(), "src");
const DATA_DIRECTORY = join(SOURCE_ROOT, "fixtures", "data");

const readRaw = <T>(name: string): T =>
  JSON.parse(readFileSync(join(DATA_DIRECTORY, name), "utf8")) as T;

/** Mirrors the production reader, so a doctored dataset differs from the committed one in one file. */
const fixtureReader: FixtureReader = (path) => readFileSync(join(DATA_DIRECTORY, path), "utf8");

const readerWith = (overrides: Readonly<Record<string, string>>): FixtureReader => {
  return (path) => overrides[path] ?? fixtureReader(path);
};

const POPULATED_PAIR = join("sessions", "api-gateway__implementation.json");
const rawPair = readRaw<AgentSession[]>(POPULATED_PAIR);
const rawRepositories = readRaw<Repository[]>("repositories.json");
const rawModels = readRaw<Model[]>("models.json");

/** The pair's rows, deep-copied, so a case can doctor one row and leave the file alone. */
const pairRows = (): AgentSession[] => JSON.parse(JSON.stringify(rawPair)) as AgentSession[];

/** The index of the first row in the pair satisfying `holds` — a case names the row it doctors. */
const indexOf = (holds: (row: AgentSession) => boolean): number => {
  const index = rawPair.findIndex(holds);
  if (index === -1) throw new Error(`${POPULATED_PAIR} holds no row matching the case`);
  return index;
};

/** One doctored row, read back through the loader exactly as the application reads the fixture. */
const readingWith = (rows: readonly AgentSession[]) => (): Dataset =>
  readDataset(readerWith({ [POPULATED_PAIR]: JSON.stringify(rows) }));

const doctored = (row: number, fields: Readonly<Record<string, unknown>>) => {
  const rows = pairRows();
  Object.assign(rows[row] as object, fields);
  return readingWith(rows);
};

/** The fault a read produced. A read that returns a dataset is itself the failure. */
const faultFrom = (read: () => unknown): Error => {
  try {
    read();
  } catch (thrown) {
    if (thrown instanceof Error) return thrown;
    throw thrown;
  }
  throw new Error("expected the load to fault; it returned a dataset");
};

/**
 * **The format the ticket asserts**: `<file name>[<row index>].<field>: <why>`. Read back as one
 * string rather than as three `toContain`s, because three parts that appear *somewhere* in a
 * sentence are not a location — a reader has to be able to open that file at that row.
 */
const locationOf = (fault: Error): string => fault.message.slice(0, fault.message.indexOf(": "));

/** The location a fault should name, spelled the way a reader would write it. */
const at = (file: string, row: number, field: string): string => `${file}[${row}].${field}`;

describe("T-U26 — a malformed row fails load, naming the file, the row and the field", () => {
  it("loads the same rows round-tripped and unmodified — the control for the six below", () => {
    // Every case doctors one field of this payload. Without this, a case could be passing
    // because the reader override itself broke the read.
    expect(readingWith(pairRows())().sessions.length).toBeGreaterThan(0);
  });

  it("rejects a negative cost — money is corrupt, not small", () => {
    const fault = faultFrom(doctored(0, { cost: -12.5 }));

    expect(fault).toBeInstanceOf(FixtureFault);
    expect(locationOf(fault)).toBe(at(POPULATED_PAIR, 0, "cost"));
    expect(fault.message).toMatch(/expected a non-negative number, received -12.5/);
  });

  it("rejects an unknown work type, which no acceptance criterion would define", () => {
    const fault = faultFrom(doctored(0, { work_type: "research" }));

    expect(fault).toBeInstanceOf(FixtureFault);
    expect(locationOf(fault)).toBe(at(POPULATED_PAIR, 0, "work_type"));
    expect(fault.message).toMatch(
      /expected one of implementation \| refactor \| bugfix \| review \| deploy, received "research"/,
    );
  });

  it("rejects a child naming a root that is not in the fixture (R-M19)", () => {
    const row = indexOf((candidate) => candidate.parent_session_id !== null);
    const fault = faultFrom(doctored(row, { parent_session_id: "ses_absent" }));

    expect(fault).toBeInstanceOf(FixtureFault);
    expect(locationOf(fault)).toBe(at(POPULATED_PAIR, row, "parent_session_id"));
    expect(fault.message).toMatch(/names root ses_absent — parent-missing/);
  });

  it("rejects `ended_at` before `started_at`, which is a negative span", () => {
    const row = indexOf((candidate) => candidate.parent_session_id === null);
    const before = rawPair[row] as AgentSession;
    const fault = faultFrom(
      doctored(row, { started_at: before.ended_at, ended_at: before.started_at }),
    );

    expect(fault).toBeInstanceOf(FixtureFault);
    expect(locationOf(fault)).toBe(at(POPULATED_PAIR, row, "ended_at"));
    expect(fault.message).toMatch(/is before started_at/);
  });

  it("rejects a token usage naming a model the roster does not declare", () => {
    const row = indexOf((candidate) => candidate.token_usage.length > 0);
    const usage = (rawPair[row] as AgentSession).token_usage.map((entry, index) =>
      index === 0 ? { ...entry, model_id: "mdl_unlisted" } : entry,
    );
    const fault = faultFrom(doctored(row, { token_usage: usage }));

    expect(fault).toBeInstanceOf(FixtureFault);
    expect(locationOf(fault)).toBe(at(POPULATED_PAIR, row, "token_usage[0].model_id"));
    expect(fault.message).toMatch(/unknown model "mdl_unlisted"/);
  });

  // The sixth case. The five above are the ticket's; this is the remaining per-row check in
  // `load.ts` that names a file, a row and a field — and the file name is the *only* place the
  // (repository × work_type) pair is declared, so a stray row is counted under the wrong
  // repository by every surface that groups by one and reads as data everywhere else.
  it("rejects a row filed under the wrong (repository × work_type) pair", () => {
    const other = rawRepositories.find((repository) => repository.id !== rawPair[0]?.repository_id);
    const fault = faultFrom(doctored(0, { repository_id: other?.id }));

    expect(fault).toBeInstanceOf(FixtureFault);
    expect(locationOf(fault)).toBe(at(POPULATED_PAIR, 0, "repository_id"));
    expect(fault.message).toMatch(/filed under the wrong pair/);
  });

  it("names the row that is wrong, not the first row of the file", () => {
    // The index is load-bearing: a fault naming `[0]` for a row at [7] sends a reader to a row
    // that is fine. Doctoring two different rows must produce two different locations.
    const last = rawPair.length - 1;
    expect(last).toBeGreaterThan(0);
    expect(locationOf(faultFrom(doctored(last, { cost: -1 })))).toBe(
      at(POPULATED_PAIR, last, "cost"),
    );
    expect(locationOf(faultFrom(doctored(0, { cost: -1 })))).toBe(at(POPULATED_PAIR, 0, "cost"));
  });

  it("names the file the row came from, not the pair the loader happened to be reading", () => {
    const another = join("sessions", "web-console__bugfix.json");
    const rows = JSON.parse(JSON.stringify(readRaw<AgentSession[]>(another))) as AgentSession[];
    expect(rows.length).toBeGreaterThan(0);
    Object.assign(rows[0] as object, { prompt_count: -4 });
    const read = (): Dataset => readDataset(readerWith({ [another]: JSON.stringify(rows) }));

    expect(locationOf(faultFrom(read))).toBe(at(another, 0, "prompt_count"));
  });

  it("holds the committed fixture to the same rule — every model named is a declared one", () => {
    // The unknown-model case above doctors a row; this is the other half of it. `models.json`
    // is the roster, and the loaded rows are asserted to name nothing outside it, so the check
    // is a property of the committed data rather than of the doctored payload alone.
    const declared = new Set(rawModels.map((model) => model.id));
    const used = new Set(
      readDataset(fixtureReader).sessions.flatMap((row) => row.token_usage.map((usage) => usage.model_id)),
    );
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((id) => !declared.has(id))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------
// T-U27 — `load()` is the only entry.
//
// The interesting half of the claim is not "an invalid dataset throws" — it is that there is no
// second door. Proved three ways: over the façade's own import graph (no module in it opens a
// file or imports JSON but `load.ts`), over the repository (the same, outside `src/data` and
// `src/fixtures`), and at runtime (a corrupted file on disk makes the façade *fault* rather than
// answer, which is only true if the façade's rows came through the validator).
// ---------------------------------------------------------------------------------------

const codeOf = (path: string): string =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .map((line) => line.replace(/(^|[^:])\/\/.*/, "$1"))
    .join("\n");

const relative = (path: string): string => path.slice(process.cwd().length + 1);

/** Every module specifier the file imports from, dynamic imports included. */
const specifiersIn = (source: string): readonly string[] =>
  [...source.matchAll(/(?:from|import\()\s*"([^"]+)"/g)].map((match) => match[1] ?? "");

/** A specifier resolved to a file in this repository, or `null` for a package or a `.json`. */
const resolveModule = (specifier: string, fromFile: string): string | null => {
  let base: string | null = null;
  if (specifier.startsWith("@/")) base = join(SOURCE_ROOT, specifier.slice(2));
  if (specifier.startsWith(".")) base = join(dirname(fromFile), specifier);
  if (base === null) return null;
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

/** The transitive import graph of a module, as absolute paths, the entry point included. */
const importGraph = (entry: string): readonly string[] => {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    for (const specifier of specifiersIn(codeOf(file))) {
      const resolved = resolveModule(specifier, file);
      if (resolved !== null && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return [...seen];
};

const FS_MODULES = ["node:fs", "node:fs/promises", "fs"];

const opensFiles = (path: string): boolean =>
  specifiersIn(codeOf(path)).some((specifier) => FS_MODULES.includes(specifier));

const importsJson = (path: string): boolean =>
  specifiersIn(codeOf(path)).some((specifier) => specifier.endsWith(".json"));

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [path] : [];
  });

describe("T-U27 — `load()` is the only entry into the data", () => {
  const facade = join(SOURCE_ROOT, "data", "queries.ts");
  const loader = join(SOURCE_ROOT, "data", "load.ts");
  const graph = importGraph(facade);

  it("walks a real graph and reaches the loader — the control for the assertions below", () => {
    // Without this, every assertion below could be passing over a graph of one file.
    expect(graph.length).toBeGreaterThan(20);
    expect(graph).toContain(loader);
    expect(graph).toContain(join(SOURCE_ROOT, "domain", "sessions.ts"));
  });

  it("holds exactly one module that opens a file, and it is `load.ts`", () => {
    expect(graph.filter(opensFiles).map(relative)).toEqual([relative(loader)]);
  });

  it("holds no module that imports fixture JSON directly", () => {
    expect(graph.filter(importsJson).map(relative)).toEqual([]);
  });

  it("reaches the loader by `loadDataset` alone — the reader-injectable doors are test-only", () => {
    // `readDataset` takes a reader, and `readFixtureFile` hands back unparsed text. Either one
    // in the façade's graph would be a way into the application that a doctored reader — or a
    // path outside `src/fixtures/data` — could walk through.
    const names = /\breadDataset\b|\breadFixtureFile\b/;
    expect(names.test(codeOf(loader))).toBe(true); // the control: the names exist to be found
    const users = graph
      .filter((path) => path !== loader)
      .filter((path) => names.test(codeOf(path)))
      .map(relative);
    expect(users).toEqual([]);
  });

  it("keeps file reading and JSON imports out of every layer above the boundary", () => {
    // The same zone `eslint.config.mjs` draws, asserted independently of ESLint running: fixture
    // I/O belongs to `src/data/**` and `src/fixtures/**`, and to no route, component or
    // domain module.
    const above = sourceFiles(SOURCE_ROOT).filter(
      (path) => !relative(path).startsWith(join("src", "data")) && !relative(path).startsWith(join("src", "fixtures")),
    );
    expect(above.length).toBeGreaterThan(20);
    expect(above.filter((path) => opensFiles(path) || importsJson(path)).map(relative)).toEqual([]);
  });

  it("leaves `load.ts` the only producer of a `Dataset`", () => {
    // A `Dataset` is only ever produced by `load.ts`. Anything else assembling one would be a
    // population that skipped the validator while typechecking perfectly.
    const returnsDataset = /:\s*Dataset\s*=>|\)\s*:\s*Dataset\s*\{/;
    expect(returnsDataset.test(codeOf(loader))).toBe(true); // the control: it finds the two in load.ts
    const producers = sourceFiles(SOURCE_ROOT)
      .filter((path) => path !== loader)
      .filter((path) => returnsDataset.test(codeOf(path)))
      .map(relative);
    expect(producers).toEqual([]);
  });
});

describe("T-U27 — the façade faults on an invalid dataset rather than answering", () => {
  const committed = readDataset(fixtureReader);
  const held = committed.memberships.find((candidate) => candidate.role === "member");

  const viewer: Viewer = sealViewer({
    memberId: held?.member_id ?? "",
    teamIds: [],
    role: roleFor(held?.role ?? "member"),
  });

  const params: ControlSet = defaultControls({
    page: "summary",
    orgSlug: committed.organization.slug,
    // P5 — the committed window ends 2026-09-08; no test here reads a clock.
    range: { start: committed.organization.window_start, end: committed.organization.window_end },
    now: "2026-09-08T12:00:00+02:00",
  });

  afterEach(() => {
    vi.doUnmock("node:fs");
    vi.resetModules();
  });

  /**
   * The façade, imported over a `node:fs` that serves `payload` for the doctored pair. Everything
   * downstream of the mock is real: the same `queries.ts`, the same `load.ts`, the same
   * validator. This is what "the query façade cannot be reached with an invalid dataset" means
   * operationally — the only entry is `loadDataset`, and it throws before anything is summed.
   */
  const facadeOver = async (payload: string | null) => {
    vi.resetModules();
    if (payload !== null) {
      vi.doMock("node:fs", async () => {
        const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
        const readFile = (
          path: Parameters<typeof readFileSync>[0],
          options?: Parameters<typeof readFileSync>[1],
        ): string | Buffer =>
          String(path).endsWith(POPULATED_PAIR) ? payload : actual.readFileSync(path, options);
        return { ...actual, default: { ...actual, readFileSync: readFile }, readFileSync: readFile };
      });
    }
    return import("./queries");
  };

  it("answers over the committed fixture — the control", async () => {
    const { summaryPage } = await facadeOver(null);
    expect(summaryPage(viewer, params).tiles.length).toBeGreaterThan(0);
  });

  it("throws instead of returning a ViewModel when a row on disk is malformed", async () => {
    const rows = pairRows();
    Object.assign(rows[0] as object, { cost: -1 });
    const { summaryPage } = await facadeOver(JSON.stringify(rows));

    // The fault is asserted by name and message rather than by `instanceof`: the module registry
    // was reset, so the class the façade throws is a different object from the one imported at
    // the top of this file. That the *message* still names file, row and field is the point.
    const fault = faultFrom(() => summaryPage(viewer, params));

    expect(fault.name).toBe("FixtureFault");
    expect(locationOf(fault)).toBe(at(POPULATED_PAIR, 0, "cost"));
  });

  it("throws for a fault the schema cannot see — the cross-row checks run on this path too", async () => {
    const rows = pairRows();
    const child = rows.findIndex((row) => row.parent_session_id !== null);
    Object.assign(rows[child] as object, { parent_session_id: "ses_absent" });
    const { summaryPage } = await facadeOver(JSON.stringify(rows));
    const fault = faultFrom(() => summaryPage(viewer, params));

    expect(fault.name).toBe("FixtureFault");
    expect(locationOf(fault)).toBe(at(POPULATED_PAIR, child, "parent_session_id"));
  });
});

/** Kept honest: the pair the cases doctor has to hold the shapes they need. */
describe("the doctored pair is representative (P6)", () => {
  it("holds roots, children and token usage", () => {
    expect(rawPair.some((row) => row.parent_session_id === null)).toBe(true);
    expect(rawPair.some((row) => row.parent_session_id !== null)).toBe(true);
    expect(rawPair.some((row) => row.token_usage.length > 0)).toBe(true);
    expect(rawPair.every((row) => row.work_type === ("implementation" as WorkType["key"]))).toBe(true);
  });
});
