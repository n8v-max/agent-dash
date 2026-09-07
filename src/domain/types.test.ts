// The domain vocabularies and the display map. `src/domain/**` is pure and framework-free
// (R-T5), so this file reads no fixture and touches no filesystem: the source-level guards
// that belong to R-T9 live in `src/data/boundary.test.ts`, where I/O is permitted.

import { describe, expect, it } from "vitest";
import {
  ARTEFACT_KINDS,
  EXECUTION_MODES,
  MACHINE_SPECS,
  MEMBER_KINDS,
  MODEL_TIERS,
  TERM_DISPLAY,
  TOKEN_CLASSES,
  WORK_TYPE_KEYS,
  WORK_TYPE_SOURCES,
} from "./types";

describe("the closed vocabularies mirror CONTEXT.md", () => {
  it("carries the five WorkType keys, global and flat — `research` was cut", () => {
    expect([...WORK_TYPE_KEYS]).toEqual(["implementation", "refactor", "bugfix", "review", "deploy"]);
    expect(WORK_TYPE_KEYS).not.toContain("research");
  });

  it("carries WorkType source as provenance, not a level", () => {
    expect([...WORK_TYPE_SOURCES]).toEqual(["vendored", "user_tuned", "api_provided"]);
  });

  it("carries the five artefact kinds, every one of them a GitHub object", () => {
    expect([...ARTEFACT_KINDS]).toEqual([
      "pull_request",
      "commit",
      "file_changed",
      "line_changed",
      "pr_comment",
    ]);
  });

  it("carries the four machine specs and the two execution modes", () => {
    expect([...MACHINE_SPECS]).toEqual(["general", "compute", "memory", "storage"]);
    expect([...EXECUTION_MODES]).toEqual(["interactive", "headless"]);
  });

  it("names execution modes after shipped precedent rather than the RPA attended/unattended pair", () => {
    expect(EXECUTION_MODES).not.toContain("attended");
    expect(EXECUTION_MODES).not.toContain("unattended");
  });

  it("carries the three cross-vendor tiers and the two Member kinds", () => {
    expect([...MODEL_TIERS]).toEqual(["frontier", "balanced", "fast"]);
    expect([...MEMBER_KINDS]).toEqual(["human", "service_account"]);
  });

  it("carries exactly four disjoint token classes — the only shape that sums safely", () => {
    expect([...TOKEN_CLASSES]).toEqual(["uncached_input", "cache_read", "cache_write", "output"]);
    expect(new Set(TOKEN_CLASSES).size).toBe(4);
    // OpenAI's `input_tokens` is a superset; the canonical set here has no such member.
    expect(TOKEN_CLASSES).not.toContain("input");
  });

  it("has no terminal-status vocabulary, because `accepted` is the only outcome field (R-M3)", () => {
    const vocabularies = [WORK_TYPE_KEYS, ARTEFACT_KINDS, MACHINE_SPECS, EXECUTION_MODES, MEMBER_KINDS];
    const values = vocabularies.flatMap((vocabulary) => [...vocabulary]);
    expect(values.filter((value) => /fail|error|terminal|status|cancel/.test(value))).toEqual([]);
  });
});

describe("R-T9 — the UI aliases live in the display map", () => {
  it("renames exactly two terms: Task is a Job, WorkType is a template", () => {
    expect(TERM_DISPLAY.task).toBe("Job");
    expect(TERM_DISPLAY.work_type).toBe("template");

    const renamed = Object.entries(TERM_DISPLAY)
      .filter(([term, label]) => term.replace(/_/g, "") !== label.toLowerCase().replace(/\s/g, ""))
      .map(([term]) => term)
      .sort();
    expect(renamed).toEqual(["task", "work_type"]);
  });

  it("leaves Repository unaliased — ADR-0004 makes repository names load-bearing", () => {
    expect(TERM_DISPLAY.repository).toBe("Repository");
    expect(Object.values(TERM_DISPLAY)).not.toContain("Project");
  });
});
