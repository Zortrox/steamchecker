import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.ts";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [crx({ manifest }), tailwindcss()],
  server: {
    watch: {
      usePolling: true,
    },
    hmr: {
      clientPort: 5174,
    },
  },
});

// TODO: styles via endpoint?

// TODO: Dynamic build process with versioning

// IDEA: Data gathering on which pages are visited the most?
