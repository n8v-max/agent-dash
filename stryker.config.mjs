// Ticket 52 — a mutation score on the computation layer.
//
// This is a measurement, not a gate. `pnpm test:mutation` is deliberately absent from
// .github/workflows/ci.yml and from the six local gates: a mutation run is minutes long and
// its number is a reading to argue with, not a threshold to satisfy. Chasing a score is how a
// suite acquires tests that pin an implementation instead of a rule (testing-spec § 1).

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "pnpm",
  testRunner: "vitest",
  // pnpm's non-flat node_modules defeats Stryker's default `@stryker-mutator/*` plugin glob —
  // the runner child process reports "no TestRunner plugins were loaded". Naming the plugin
  // resolves it by specifier instead of by directory scan.
  plugins: ["@stryker-mutator/vitest-runner"],
  reporters: ["html", "clear-text", "progress"],

  // Per-test coverage: a mutant is only re-run against the tests that actually executed the
  // line, which is what makes a run over ~3,400 lines of domain code finish in minutes.
  coverageAnalysis: "perTest",

  // R-T34 / T-Q2 scopes the raised coverage bar to src/domain, and this follows it. The layers
  // above are glue — components that cannot compute (R-T6) and route shells — where a surviving
  // mutant says more about the layer's thinness than about the suite.
  mutate: [
    "src/domain/**/*.ts",
    "!src/domain/**/*.{test,spec}.ts",
    // src/domain/testing/** holds ticket 51's fast-check generators: test helpers that happen to
    // live under src/domain because the coverage thresholds walk that directory. They are not
    // production code and nothing asserts what they emit, so every mutant in them survives by
    // construction — a generator that draws a different distribution is still a valid generator.
    // Mutating them would inflate the denominator with noise no test could honestly kill.
    "!src/domain/testing/**",
  ],

  // Every survivor is printed with its position and its diff, uncapped — the list in the ticket
  // is the whole list. What is suppressed is the per-mutant roll-call of tests, which is the
  // noise: forty test names beside each of 1,362 mutants buries the lines worth reading.
  clearTextReporter: { maxTestsToLog: 0, reportTests: false, allowEmojis: false },

  // Raised from the 5s default. `periods.ts` iterates day ranges, so an off-by-one in a loop
  // bound produces a mutant that is slow rather than wrong; a tight budget would score those as
  // killed for being slow and hide whether a test actually catches them. Four to six mutants still
  // time out at 10s — those are genuinely non-terminating, and a timeout is a kill either way.
  timeoutMS: 10000,
  timeoutFactor: 2,

  // One vitest instance per worker, on a 10-core machine, leaving headroom for the editor.
  concurrency: 6,

  tempDirName: ".stryker-tmp",
};

export default config;
