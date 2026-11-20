import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e", timeout: 45_000, fullyParallel: false, retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:5174", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVERS ? undefined : [
    { command: "npm run dev -w @aureva/api", url: "http://localhost:4100/health", reuseExistingServer: true, timeout: 120_000 },
    { command: "npm run dev -w @aureva/web", url: "http://localhost:5174", reuseExistingServer: true, timeout: 120_000 }
  ]
});
