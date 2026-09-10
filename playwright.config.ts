import { defineConfig, devices } from "@playwright/test";
import { PINNED_NOW, PINNED_NOW_ENV } from "./e2e/support/now";

// T-E3 and T-E4 mint session tokens in the test process, so they need the same
// `AUTH_JWT_SECRET` the server signs with. CI sets it as a workflow env var; locally it lives
// in `.env.local`, which Next loads for the dev server but nothing loads for this process.
// Node 24 reads the file natively — no dotenv dependency, and no second copy of the key.
if (!process.env.AUTH_JWT_SECRET) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    throw new Error(
      "AUTH_JWT_SECRET is not set and .env.local could not be read. The e2e suite signs " +
        "tokens with the same key the server verifies with; see .env.example.",
    );
  }
}

/** `process.env` with the unset keys dropped — Playwright's `env` takes strings, not `undefined`. */
const inheritedEnv = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Cross-browser rendering is not what this project demonstrates; one engine keeps CI cheap.
  //
  // Two projects, one engine, and **one width each** (ticket 46). `mobile-chromium` exists
  // because R-V15's claim is a measurement that only exists at a phone width — every other spec
  // asserts rows, URLs and mirror cells, which a viewport cannot change. Running the whole file
  // set twice would roughly double the suite's runtime to re-prove them, so the split is by
  // file: `mobile.spec.ts` runs at 390 and nowhere else, and the desktop project ignores it.
  //
  // The two existing tests that genuinely need a second width — the R-N8 breakdown tile and the
  // R-C6 toolbar — call `setViewportSize` themselves inside the desktop project, which keeps the
  // width beside the requirement it belongs to rather than in this file.
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile\.spec\.ts/,
      // 390×844 — the iPhone 14 CSS viewport, which is the width ticket 46 states R-V15 at.
      // Chromium's own descriptor rather than a WebKit device profile: the engine stays one.
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // CI runs the production build (the workflow builds first); locally, dev is fast enough.
    command: isCI
      ? `pnpm exec next start --port ${PORT}`
      : `pnpm exec next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    // **The server under test is pinned to one instant** (ticket 62). Every figure this suite
    // asserts is read against `now` — the window, the period menu, the date bounds and, once the
    // fixture runs past today, the rows themselves — so an unpinned clock makes a green suite a
    // property of the day it ran on. `env` reaches the spawned server and nothing else; it is
    // set in no committed production config and is absent on Vercel. See `e2e/support/now.ts`.
    //
    // `reuseExistingServer` is on locally, so a dev server already running on this port is used
    // as it stands — start it through `pnpm e2e` (or restart it) to have the pin apply.
    //
    // `env` *replaces* the command's environment rather than extending it, so the inherited one
    // is spread back in first — without it the spawned server loses `PATH` and never starts.
    env: { ...inheritedEnv(), [PINNED_NOW_ENV]: PINNED_NOW },
  },
});
