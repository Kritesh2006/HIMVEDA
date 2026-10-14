import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a running, seeded instance:
 *   npm run db:reset && npm run build && npm start
 *   E2E_ADMIN_CODE=•••• E2E_ADMIN_CODE_2=•••• npm run test:e2e
 * Admin tests are skipped when E2E_ADMIN_CODE is not set. Codes are never stored in the repo.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    timezoneId: "Asia/Kathmandu", // deterministic NPR display unless a test sets its own context
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : undefined } }],
});
