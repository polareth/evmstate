// vite.config.ts
import { vitePluginTevm } from "tevm/bundler/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vitePluginTevm()],
  resolve: {
    alias: {
      "@/*": "./src/*",
      "@test/*": "./test/*",
    },
  },
  test: {
    testTimeout: 60_000,
  },
});
