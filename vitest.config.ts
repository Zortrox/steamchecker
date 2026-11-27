import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests don't load the crx plugin.
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
