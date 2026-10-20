/**
 * The components in jsdom with React's client renderer and react-markdown: boards, problems and
 * onProblems, streaming, the viewer (chips, zoom), the expanded view, and the stylesheet. jsdom has
 * no ResizeObserver, setPointerCapture or <dialog> methods, so they're stubbed.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
before(() => {
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  // Node 21+ has its own navigator (read-only); Node 20 has none, and React DOM reads it
  if (typeof navigator === "undefined") Object.assign(globalThis, { navigator: dom.window.navigator });
  Object.assign(globalThis, {
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), // the viewer checks the stage's position
  });
  dom.window.HTMLElement.prototype.setPointerCapture = () => {};
  const D = dom.window.HTMLDialogElement.prototype as any;
  D.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  D.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new dom.window.Event("close")); };
});
after(() => dom.window.close());

const example = (name: string) => readFileSync(new URL(`../node_modules/tsquare/examples/${name}.tsq`, import.meta.url), "utf8");
const SIGN_IN = example("sign-in");
const FLOW = example("sign-up-flow"); // three screens
const BROKEN = 'board\n  screen phone\n    buton "Oops"';

// React and the components load after the globals above exist
const load = async () => {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const lib = await import("../src/index.js");
  const tsquare = await import("tsquare");
  const Markdown = (await import("react-markdown")).default;
  return { h: React.createElement, act: React.act, createRoot, lib, tsquare, Markdown };
};

async function mount(element: React.ReactElement) {
  const { createRoot, act } = await load();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    $: (sel: string) => container.querySelector(sel) as HTMLElement | null,
    $$: (sel: string) => [...container.querySelectorAll(sel)] as HTMLElement[],
    rerender: (el: React.ReactElement) => act(async () => root.render(el)),
    unmount: () => act(async () => root.unmount()),
  };
}

/** Wait until the rendering settles (satori runs asynchronously after the effect). */
async function until(check: () => boolean, what: string) {
  const { act } = await load();
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await act(() => new Promise((r) => setTimeout(r, 25)));
  }
  assert.fail(`timed out waiting for ${what}`);
}
const settle = async (ms = 300) => { const { act } = await load(); await act(() => new Promise((r) => setTimeout(r, ms))); };
const svgOf = (src: string) => Buffer.from(src.replace(/^data:image\/svg\+xml;base64,/, ""), "base64").toString("utf8");

test("Wireframe: the board as an image of its SVG, with its size and title", async () => {
  const { h, lib, tsquare } = await load();
  const view = await mount(h(lib.Wireframe, { source: SIGN_IN, className: "mine" }));
  await until(() => !!view.$("img"), "the board");
  const figure = view.$("figure")!;
  assert.equal(figure.className, "tsquare-board mine");
  const img = view.$("img.tsquare-board-image") as HTMLImageElement;
  assert.equal(svgOf(img.getAttribute("src")!), await tsquare.renderWireframe(SIGN_IN), "a data: URL holding exactly the board's SVG");
  assert.ok(Number(img.getAttribute("width")) > 0 && Number(img.getAttribute("height")) > 0);
  assert.equal(img.getAttribute("alt"), "Wireframe: Sign in");
  assert.equal(img.getAttribute("style"), "max-width: 100%; height: auto;", "the only inline styles: fit the container");
  assert.equal(view.$(".tsquare-expand"), null, "not expandable unless asked");
  assert.equal(figure.getAttribute("aria-busy"), null);
  await view.unmount();
});

test("Wireframe: problems listed by line, with class names to style; showProblems={false} hides them", async () => {
  const { h, lib } = await load();
  const view = await mount(h(lib.Wireframe, { source: BROKEN }));
  await until(() => !!view.$(".tsquare-problems"), "the problems");
  assert.equal(view.$(".tsquare-problems")!.getAttribute("role"), "note");
  assert.equal(view.$(".tsquare-problems-title")!.textContent, "1 problem in this wireframe");
  assert.match(view.$("ul.tsquare-problems-list > li.tsquare-problem")!.textContent!, /^line 3: unknown component "buton" \(did you mean button\?\)/);
  assert.equal(view.$("[style]"), null, "no inline styles");
  await view.rerender(h(lib.Wireframe, { source: BROKEN, showProblems: false }));
  assert.equal(view.$(".tsquare-problems"), null);
  await view.unmount();
});

test("onProblems: the list when the complete text has problems, [] once fixed, nothing for valid text or mid-stream", async () => {
  const { h, lib } = await load();
  const calls: unknown[] = [];
  const onProblems = (p: unknown) => calls.push(p);
  const el = (source: string, streaming = false) => h(lib.Wireframe, { source, streaming, onProblems, showProblems: false });

  const view = await mount(el(SIGN_IN));
  await until(() => !!view.$("img"), "the board");
  await settle();
  assert.deepEqual(calls, [], "valid text: no call");

  await view.rerender(el(BROKEN, true));
  await settle(500);
  assert.deepEqual(calls, [], "mid-stream: no call");

  await view.rerender(el(BROKEN));
  await until(() => calls.length === 1, "the problems");
  const [problems] = calls as { line: number; message: string }[][];
  assert.equal(problems.length, 1);
  assert.equal(problems[0].line, 3);
  assert.match(problems[0].message, /unknown component "buton"/);
  assert.equal(view.$(".tsquare-problems"), null, "the app handles them: nothing shown");

  await view.rerender(el(BROKEN + "\n")); // same problems: no repeat
  await settle();
  assert.equal(calls.length, 1);

  await view.rerender(el(SIGN_IN));
  await until(() => calls.length === 2, "the all-clear");
  assert.deepEqual(calls[1], []);
  await view.unmount();
});

test("while streaming, the board keeps the last good version and problems wait until the text is complete", async () => {
  const { h, lib } = await load();
  const el = (source: string, streaming: boolean) => h(lib.Wireframe, { source, streaming });
  const view = await mount(el(SIGN_IN, true));
  await until(() => !!view.$("img"), "the first board");
  const first = view.$("img")!.getAttribute("src");

  await view.rerender(el(SIGN_IN + "\n    butto", true)); // a partial line: not valid yet
  await until(() => view.$("figure")!.getAttribute("aria-busy") === null, "the partial text to be checked");
  assert.equal(view.$("img")!.getAttribute("src"), first, "the last good board stays");
  assert.ok(!view.$("figure")!.classList.contains("tsquare-stale"), "not dimmed mid-stream (it would flicker)");
  assert.equal(view.$(".tsquare-problems"), null, "no problems while streaming");

  // more text arrives and the board changes (here its title)
  await view.rerender(el(SIGN_IN.replace('board "Sign in"', 'board "Sign in again"'), true));
  await until(() => view.$("img")!.getAttribute("src") !== first, "the new board");

  await view.rerender(el(SIGN_IN + "\n    butto", false)); // the reply ends with a mistake
  await until(() => !!view.$(".tsquare-problems"), "the problems");
  assert.ok(view.$("figure")!.classList.contains("tsquare-stale"), "the last good board, dimmed");
  await view.unmount();
});

test("a steady stream still shows boards along the way, not only at the end", async () => {
  const { h, lib } = await load();
  const lines = SIGN_IN.split("\n");
  const view = await mount(h(lib.Wireframe, { source: lines.slice(0, 3).join("\n"), streaming: true }));
  const seen = new Set<string>();
  for (let i = 3; i <= lines.length; i++) {
    for (const chunk of [lines.slice(0, i).join("\n").slice(0, -3), lines.slice(0, i).join("\n")]) {
      await view.rerender(h(lib.Wireframe, { source: chunk, streaming: true }));
      await new Promise((r) => setTimeout(r, 20)); // a token every 20 ms, never pausing
      const src = view.$("img")?.getAttribute("src");
      if (src) seen.add(src);
    }
  }
  assert.ok(seen.size >= 1, "a board appeared before the stream ended");
  await view.unmount();
});

test("expandable: a button (or selecting the board) opens it full size in the viewer, in a dialog", async () => {
  const { h, act, lib } = await load();
  const view = await mount(h(lib.Wireframe, { source: FLOW, expandable: true }));
  await until(() => !!view.$("img"), "the board");
  const button = view.$("button.tsquare-expand")!;
  assert.equal(button.getAttribute("aria-label"), "Open full size");
  const dialog = view.$("dialog.tsquare-dialog") as HTMLDialogElement;
  assert.ok(!dialog.hasAttribute("open"));
  assert.equal(dialog.querySelector(".tsquare-viewer"), null, "the viewer mounts only when opened");

  await act(async () => button.click());
  assert.ok(dialog.hasAttribute("open"));
  assert.equal(dialog.querySelector(".tsquare-dialog-title")!.textContent, "Sign-up flow");
  await until(() => !!dialog.querySelector(".tsquare-canvas img"), "the board in the viewer");
  assert.deepEqual([...dialog.querySelectorAll(".tsquare-chips button")].map((b) => b.textContent), ["All", "Create account", "Verify email", "Welcome"]);

  await act(async () => (dialog.querySelector(".tsquare-dialog-close") as HTMLElement).click());
  assert.ok(!dialog.hasAttribute("open"));
  await act(async () => (view.$("img") as HTMLElement).click());
  assert.ok(dialog.hasAttribute("open"), "selecting the board opens it too");
  await view.unmount();
});

test("WireframeViewer: chips per screen and zoom buttons, each optional; problems over the board", async () => {
  const { h, act, lib } = await load();
  const view = await mount(h(lib.WireframeViewer, { source: FLOW, className: "mine" }));
  await until(() => !!view.$(".tsquare-canvas img"), "the board");
  assert.equal(view.$(".tsquare-viewer")!.className, "tsquare-viewer mine");
  assert.equal(view.$(".tsquare-canvas img")!.getAttribute("alt"), "Wireframe: Sign-up flow");
  const chips = () => view.$$(".tsquare-chips button");
  assert.deepEqual(chips().map((b) => b.textContent), ["All", "Create account", "Verify email", "Welcome"]);
  assert.equal(chips()[0].getAttribute("aria-pressed"), "true", "fitted to start");

  await act(async () => view.$(".tsquare-zoom-in")!.click());
  assert.equal(view.$(".tsquare-zoom-level")!.textContent, "125%");
  assert.equal(chips()[0].getAttribute("aria-pressed"), "false");
  await act(async () => view.$(".tsquare-zoom-out")!.click());
  assert.equal(view.$(".tsquare-zoom-level")!.textContent, "100%");

  await view.rerender(h(lib.WireframeViewer, { source: FLOW, chips: false, zoomControls: false }));
  await until(() => !!view.$(".tsquare-canvas img"), "the board again");
  assert.equal(view.$(".tsquare-viewer-bar"), null, "no bar at all");
  assert.equal(view.$(".tsquare-zoom"), null);

  await view.rerender(h(lib.WireframeViewer, { source: BROKEN }));
  await until(() => !!view.$(".tsquare-note .tsquare-problems"), "the problems over the board");
  assert.match(view.$(".tsquare-note .tsquare-problem")!.textContent!, /^line 3: /);
  await view.unmount();
});

test("tsquareComponents: react-markdown's ```tsquare blocks become boards, other code blocks stay", async () => {
  const { h, lib, Markdown } = await load();
  const markdown = `Here's the screen:\n\n\`\`\`tsquare\n${SIGN_IN}\`\`\`\n\nAnd some code:\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n`;
  const view = await mount(h(Markdown, { components: lib.tsquareComponents }, markdown));
  await until(() => !!view.$("figure.tsquare-board img"), "the board");
  assert.equal(view.$$("figure.tsquare-board").length, 1);
  assert.equal(view.$("pre code.language-js")!.textContent, "const x = 1;\n");
  assert.equal(view.$("code.language-tsquare"), null);
  await view.unmount();
});

test("createTsquareComponents: options for every board; onProblems gets each block's problems and text", async () => {
  const { h, lib, Markdown } = await load();
  const calls: [unknown, string][] = [];
  const components = lib.createTsquareComponents({ expandable: true, showProblems: false, onProblems: (p, source) => calls.push([p, source]) });
  const markdown = "```tsquare\n" + SIGN_IN + "```\n\n```tsquare\n" + BROKEN + "\n```\n";
  const view = await mount(h(Markdown, { components }, markdown));
  await until(() => !!view.$("figure.tsquare-board img") && calls.length === 1, "the board and the broken block's problems");
  assert.ok(view.$(".tsquare-expand"), "expandable");
  assert.equal(view.$(".tsquare-problems"), null, "problems hidden");
  assert.equal(calls[0][1], BROKEN, "with the block's text");
  assert.equal((calls[0][0] as unknown[]).length, 1);
  await view.unmount();
});

test("WireframeStreaming sets streaming for the boards inside (a reply still arriving in react-markdown)", async () => {
  const { h, lib, Markdown } = await load();
  const reply = (body: string, streaming: boolean) =>
    h(lib.WireframeStreaming, { value: streaming }, h(Markdown, { components: lib.tsquareComponents }, body));
  const view = await mount(reply("```tsquare\n" + BROKEN, true)); // the fence isn't closed yet
  await settle(400);
  assert.equal(view.$(".tsquare-problems"), null, "held back while streaming");
  await view.rerender(reply("```tsquare\n" + BROKEN + "\n```\n", false));
  await until(() => !!view.$(".tsquare-problems"), "the problems once the reply is done");
  await view.unmount();
});

test("styles.css: every class the components use is styled, every rule is low-priority (:where), dark and light hooks", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const sources = ["wireframe", "viewer", "problems"].map((f) => readFileSync(new URL(`../src/${f}.tsx`, import.meta.url), "utf8")).join("\n");
  const used = new Set([...sources.matchAll(/\btsquare-[a-z-]+/g)].map((m) => m[0]));
  for (const cls of used) assert.ok(css.includes(`.${cls}`), `.${cls} has styles`);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\{)/g)!.map((s) => s.trim()).filter((s) => s && !s.startsWith("@"));
  for (const selector of rules) assert.match(selector, /^:where\(/, `${selector} is wrapped in :where()`);
  assert.match(css, /:where\(\.dark, \[data-theme="dark"\]\)/);
  assert.match(css, /:where\(\.light, \[data-theme="light"\]\)/);
  for (const v of ["bg", "fg", "muted", "border", "stage", "accent", "accent-fg", "error", "font", "font-mono", "radius"]) assert.ok(css.includes(`var(--tsquare-${v},`), `--tsquare-${v}`);
});
