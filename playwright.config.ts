import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests against the static export (`npm run build` first):
 *   npm run e2e
 * The server honours NEXT_PUBLIC_BASE_PATH, like GitHub Pages.
 */
const PORT = 4173;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE_PATH}/`,
    trace: "retain-on-failure",
  },
  projects: [
    // *.desktop.spec.ts run on a desktop (mouse, keyboard); the rest on a phone.
    { name: "phone", testIgnore: /\.desktop\.spec\.ts$/, use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "desktop", testMatch: /\.desktop\.spec\.ts$/, use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `node scripts/tools/serveOut.cjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}${BASE_PATH}/`,
    reuseExistingServer: !process.env.CI,
  },
});
