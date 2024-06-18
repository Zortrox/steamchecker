import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
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

// TODO: Remove steam API key from git (and revoke for a new one) https://steamcommunity.com/dev/apikey
