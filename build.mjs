// Builds dist/: index.js (ESM, "use client" for React Server Components frameworks), index.d.ts, styles.css.
// react and tsquare stay imports: the app's bundler resolves them, tsquare to its browser build.
import { execFileSync } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2020",
  jsx: "automatic",
  packages: "external",
  banner: { js: '"use client";' },
  logLevel: "warning",
});
copyFileSync("src/styles.css", "dist/styles.css");
execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { stdio: "inherit" });
console.log("built dist/");
