import { defineConfig } from "@playwright/test";

/**
 * End to end tests: the site (next dev on 3005, isolated dist dir) against
 * the local mock buyer host (8787). Locally, already-running servers are
 * reused; in CI both are started fresh.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3005",
  },
  webServer: [
    {
      command: "npm run mock-host",
      port: 8787,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npx next dev -p 3005",
      port: 3005,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
