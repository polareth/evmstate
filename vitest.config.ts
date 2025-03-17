// vite.config.ts
import { defineConfig } from 'vitest/config';
import { vitePluginTevm } from 'tevm/bundler/vite-plugin';

export default defineConfig({
  plugins: [vitePluginTevm()],
  test: {
    testTimeout: 60_000,
  },
});
