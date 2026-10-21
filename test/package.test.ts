/**
 * The built package (needs npm run build): the main entry never reaches tsquare/editor, so apps that
 * only show boards don't bundle CodeMirror; the editor entry does; both share one copy of the code.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;

/** Every file an entry loads (following relative imports) and every package import among them. */
function reach(entry: string) {
  const files = new Set<string>();
  const packages = new Set<string>();
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    for (const [, spec] of readFileSync(file, "utf8").matchAll(/(?:from|import)\s*"([^"]+)"/g)) {
      if (spec.startsWith(".")) visit(join(dirname(file), spec));
      else packages.add(spec);
    }
  };
  visit(join(dist, entry));
  return { files, packages };
}

test("the main entry doesn't reach tsquare/editor (CodeMirror); the editor entry does, sharing the rest", () => {
  const main = reach("index.js");
  const editor = reach("editor.js");
  assert.ok(!main.packages.has("tsquare/editor"), `main reaches: ${[...main.packages]}`);
  assert.ok(editor.packages.has("tsquare/editor"));
  const shared = [...main.files].filter((f) => f.includes("/chunks/"));
  assert.ok(shared.length && shared.every((f) => editor.files.has(f)), "one shared chunk (one streaming context)");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(pkg.exports), [".", "./editor", "./styles.css"]);
  for (const f of [...main.files, ...editor.files]) assert.ok(readFileSync(f, "utf8").startsWith('"use client";'), `${f} starts with "use client"`);
});
