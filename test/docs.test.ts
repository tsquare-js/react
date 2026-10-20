/**
 * The docs (docs/*.md, shown on tsquare.dev/docs/react, and README.md) against the code: every
 * tsx example typechecks against the package, every prop and option is documented, links between
 * the pages resolve (anchors included), and the wireframes inside examples are valid.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileWireframe } from "tsquare";

const root = new URL("..", import.meta.url).pathname;
const pages = Object.fromEntries(readdirSync(join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => [f, readFileSync(join(root, "docs", f), "utf8")]));
const readme = readFileSync(join(root, "README.md"), "utf8");
const blocks = (md: string, lang: string) => [...md.matchAll(new RegExp("^```" + lang + "\\n([\\s\\S]*?)^```$", "gm"))].map((m) => m[1]);
const slug = (heading: string) => heading.toLowerCase().replace(/[`<>]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

test("every tsx example in the docs and README typechecks against the package", () => {
  const dir = join(root, "test", ".examples");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const examples = [...Object.entries(pages), ["README.md", readme] as const].flatMap(([page, md]) => blocks(md, "tsx").map((code, i) => ({ name: `${page.replace(".md", "")}-${i + 1}.tsx`, code })));
  assert.ok(examples.length >= 15, `${examples.length} examples`);
  for (const e of examples) writeFileSync(join(dir, e.name), e.code);
  writeFileSync(join(dir, "css.d.ts"), 'declare module "*.css";\n');
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, skipLibCheck: true, noEmit: true,
      lib: ["ES2022", "DOM"], baseUrl: ".", paths: { "@tsquare-js/react": ["../../src/index.ts"], "@tsquare-js/react/styles.css": ["../../src/styles.css"] },
    },
    include: ["*.tsx", "css.d.ts"],
  }));
  try {
    execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", dir], { encoding: "utf8" });
  } catch (err) {
    assert.fail(`docs examples don't typecheck:\n${(err as { stdout?: string }).stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every prop and option is documented on its page", () => {
  const src = (f: string) => readFileSync(join(root, "src", f), "utf8");
  const props = (code: string, name: string) => {
    const body = code.match(new RegExp(`interface ${name}[^{]*\\{([\\s\\S]*?)\\n\\}`))![1];
    return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
  };
  const cases: [string, string, string][] = [
    ["wireframe.tsx", "WireframeProps", "wireframe.md"],
    ["viewer.tsx", "WireframeViewerProps", "viewer.md"],
    ["markdown.tsx", "TsquareComponentsOptions", "chat.md"],
    ["editor.tsx", "WireframeEditorProps", "editor.md"],
    ["playground.tsx", "WireframePlaygroundProps", "playground.md"],
  ];
  for (const [file, iface, page] of cases) {
    const names = props(src(file), iface);
    assert.ok(names.length >= 3, `${iface}: ${names}`);
    for (const p of names) assert.ok(pages[page].includes("`" + p + "`"), `${iface}.${p} is documented in docs/${page}`);
  }
});

test("links between the docs pages resolve, anchors included", () => {
  for (const [page, md] of [...Object.entries(pages), ["README.md", readme] as const]) {
    for (const [, target, anchor] of md.matchAll(/\]\((?!https?:)([\w-]+\.md)?(?:#([\w-]+))?\)/g)) {
      if (!target && !anchor) continue;
      const file = target ?? page;
      const where = page === "README.md" && target ? null : pages[file];
      if (page === "README.md" && target) continue; // README links into docs/ by URL
      assert.ok(where, `${page} links to ${file}, which exists`);
      if (anchor) {
        const headings = [...where!.matchAll(/^#+ (.+)$/gm)].map((m) => slug(m[1]));
        assert.ok(headings.includes(anchor), `${page} → ${file}#${anchor}: headings are ${headings.join(", ")}`);
      }
    }
  }
});

test("the wireframes inside the examples are valid", () => {
  const wireframes = Object.values(pages).flatMap((md) => [...md.matchAll(/`(board[^`]*)`/g)].map((m) => m[1]).filter((t) => t.includes("\n")));
  assert.ok(wireframes.length >= 1);
  for (const text of wireframes) assert.deepEqual(compileWireframe(text).issues, [], text);
});
