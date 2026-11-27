import { defineConfig } from "@playwright/test";

// Store listing screenshots from the live humblebundle.com (see store-screenshots/).
// Run `bun run build` first; uses dist/ like the e2e tests.
export default defineConfig({
  testDir: "store-screenshots",
  timeout: 180_000,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/store-screenshots",
});
