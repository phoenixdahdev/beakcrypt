import { defineConfig } from "tsup";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  outExtension: () => ({ js: ".js" }),
  outDir: "dist",
  target: "node20",
  platform: "node",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  noExternal: ["@beakcrypt/convex", "@beakcrypt/shared", "@beakcrypt/crypto"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    VERSION: JSON.stringify(pkg.version),
  },
});
