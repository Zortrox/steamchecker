import { defineConfig } from "@playwright/test";

// Loads the built extension from dist/ into Chromium. Run `bun run build` first.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results",
});
