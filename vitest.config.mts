import { readdirSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// R-T34 / T-Q2: src/domain carries a raised bar — 95% statements, 90% branches. The global
// figure is a floor for a codebase that includes glue; the domain layer is pure functions
// with no I/O and no framework, and it is where the grade actually is.
const DOMAIN_THRESHOLDS = { statements: 95, branches: 90 };

// Amendment item 6 wanted `perFile: true` on that threshold, so a well-covered module cannot
// carry an untested one under a directory average. Vitest 4 does not accept `perFile` inside
// a glob group — it is a single top-level flag, and setting it there would make the *global*
// 80% per-file as well. That contradicts T-Q1 ("global thresholds stay as committed") and
// testing-spec § 10, which plans for thin, near-trivial component coverage carried by the
// domain layer; per-file 80% would fail each of those components individually.
//
// One threshold group per domain file is the same check without the collateral: vitest
// evaluates every glob key as its own coverage map, so a group holding one file *is*
// per-file. The list is rebuilt on each run, so a new domain module is covered the moment
// it exists rather than when someone remembers to add it here.
const isDomainModule = (name: string) =>
  name.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(name) && !name.endsWith(".d.ts");

const domainModules = (dir = "src/domain"): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return domainModules(path);
    return isDomainModule(entry.name) ? [path] : [];
  });

const domainFileThresholds = Object.fromEntries(
  domainModules().map((file) => [file, DOMAIN_THRESHOLDS]),
);

export default defineConfig({
  plugins: [react()],
  // Vite 8 resolves the tsconfig "@/*" alias natively; vite-tsconfig-paths is obsolete.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Unit tests are colocated with the code they cover. `e2e/` belongs to Playwright.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.d.ts",
        // Route shells compose; they carry no logic worth a unit test. Playwright covers them.
        "src/app/**/{layout,template,error,not-found,loading,default}.tsx",
        // Vendored shadcn primitives and the fixture generator (T-P3: tests read committed
        // output, never the generator).
        "src/components/ui/**",
        "src/fixtures/**",
        "src/lib/utils.ts",
      ],
      thresholds: {
        // T-Q1 — unchanged, and deliberately directory-averaged.
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
        // R-T34 — the directory as a whole...
        "src/domain/**": DOMAIN_THRESHOLDS,
        // ...and each module in it on its own (amendment item 6).
        ...domainFileThresholds,
      },
    },
  },
});
