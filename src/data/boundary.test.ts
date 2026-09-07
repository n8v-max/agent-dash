// Two boundary guards that are cheaper to assert over the source than to hope for.
//
// They live in `src/data/` because reading files is permitted here and nowhere above it: the
// domain layer may not import `node:fs` (R-T5), so a source-level guard cannot be colocated
// with the code it guards.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
const FIXTURES = join("src", "fixtures");

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mts)$/.test(entry.name) ? [path] : [];
  });

/**
 * Comments state what the code does *not* do, so the guards below must read the code only.
 * Stripped line by line rather than with a block-comment regex: a `[\s\S]*?` scan over a
 * whole file backtracks, and every comment in this repo is line-prefixed anyway.
 */
const codeOf = (path: string): string =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .map((line) => line.replace(/(^|[^:])\/\/.*/, "$1"))
    .join("\n");

const relative = (path: string): string => path.slice(process.cwd().length + 1);

const applicationSources = sourceFiles(SOURCE_ROOT)
  .filter((path) => !relative(path).startsWith(FIXTURES))
  .filter((path) => !/\.(test|spec)\.tsx?$/.test(path));

// A pricing function call or definition, a compute rate being read, or a rate being
// multiplied by anything. Any of the three is money being computed rather than read.
const PRICING = [/\bprice[A-Z]\w*\s*\(/, /\.usd_per_hour\b/, /\brate\.\w+\s*\*/];

const prices = (source: string): boolean => PRICING.some((pattern) => pattern.test(source));

describe("R-T11 / R-M4 — cost is read, never computed", () => {
  it("finds the pricing code where ADR-0005 put it — the control for the assertion below", () => {
    expect(prices(codeOf(join(SOURCE_ROOT, "fixtures", "pricing.mts")))).toBe(true);
  });

  it("finds no pricing function anywhere in the application", () => {
    const offenders = applicationSources.filter((path) => prices(codeOf(path))).map(relative);
    expect(offenders).toEqual([]);
  });

  it("keeps the generator out of the application entirely", () => {
    const importers = applicationSources
      .filter((path) => /from\s+"(@\/fixtures|[./]+fixtures)/.test(codeOf(path)))
      .map(relative);
    expect(importers).toEqual([]);
  });
});

describe("R-T9 — an alias is a label, never a type name", () => {
  it("declares no `Job` or `Template` type, in any layer", () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .filter((path) => /\b(type|interface|class|enum)\s+(Job|Jobs|Template|Templates)\b/.test(codeOf(path)))
      .map(relative);
    expect(offenders).toEqual([]);
  });

  it("keeps the alias out of the domain layer's identifiers", () => {
    const domain = sourceFiles(join(SOURCE_ROOT, "domain")).filter((path) => !/\.test\.ts$/.test(path));
    expect(domain.length).toBeGreaterThan(0);
    for (const path of domain) {
      // "Job"/"template" may appear as a *value* in the display map, never as an identifier.
      expect(codeOf(path)).not.toMatch(/\b(Job|Template)\w*\s*[:=(<]/);
    }
  });
});
