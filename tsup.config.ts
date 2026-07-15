import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/create-client.ts",
  ],

  outDir: "dist",

  format: ["esm", "cjs"],

  target: "node22",

  platform: "node",

  bundle: false,

  splitting: false,

  sourcemap: true,

  clean: true,

  dts: true,

  minify: false,

  treeshake: true,

  keepNames: true,

  skipNodeModulesBundle: true,

  cjsInterop: true,

  shims: false,
});