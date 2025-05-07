import { vitePluginTevm } from "tevm/bundler/vite-plugin";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vitePluginTevm({ solc: "0.8.23" }), tsconfigPaths()],
  test: {
    testTimeout: 600_000,
    hookTimeout: 60_000,
    setupFiles: ["./test/setup.tsx"],
  },
});
