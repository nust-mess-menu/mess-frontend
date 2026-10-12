import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests against a running stack:
 *   Firebase emulators (Firestore + Auth) -> mess-backend -> this app (production build).
 * See README "End-to-end tests". Uses the locally installed Chrome.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "e2e/.results",
});
