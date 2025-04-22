import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/react/index.ts"], // Define both entry points
  format: ["cjs", "esm"], // Output both CommonJS and ES modules
  dts: true, // Generate declaration files (.d.ts)
  splitting: true, // Enable code splitting
  sourcemap: true, // Generate sourcemaps
  clean: true, // Clean output directory before build
  external: ["react", "react-dom"], // Mark react and react-dom as external
});
