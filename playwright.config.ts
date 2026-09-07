import { defineConfig, devices } from "@playwright/test";

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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI runs the production build (the workflow builds first); locally, dev is fast enough.
    command: isCI
      ? `pnpm exec next start --port ${PORT}`
      : `pnpm exec next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
