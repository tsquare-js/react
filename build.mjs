// Builds dist/: index.js and editor.js (ESM, "use client" for React Server Components frameworks),
// their shared code in dist/chunks/, the .d.ts files, styles.css. Two entries so the main one never
// imports tsquare/editor (CodeMirror): apps that only show boards don't bundle it.
// react and tsquare stay imports: the app's bundler resolves them, tsquare to its browser build.
import { execFileSync } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: { index: "src/index.ts", editor: "src/entry-editor.ts" },
  outdir: "dist",
  splitting: true, // one copy of the shared code (the streaming context must be one instance)
  chunkNames: "chunks/[name]-[hash]",
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
