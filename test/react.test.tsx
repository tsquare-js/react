/**
 * The components in jsdom with React's client renderer and react-markdown: boards, problems and
 * onProblems, streaming, the viewer (chips, zoom), the expanded view, the editor and playground, and
 * the stylesheet. jsdom has no ResizeObserver, setPointerCapture, <dialog> methods or ranges with
 * layout (CodeMirror), so they're stubbed.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import type { MeasuredElement } from "tsquare";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true }); // requestAnimationFrame, for CodeMirror
let disconnected = 0; // ResizeObservers stopped (the viewer's destroy())
before(() => {
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  // Node 21+ has its own navigator (read-only); Node 20 has none, and React DOM reads it
  if (typeof navigator === "undefined") Object.assign(globalThis, { navigator: dom.window.navigator });
  Object.assign(globalThis, {
    ResizeObserver: class { observe() {} unobserve() {} disconnect() { disconnected++; } },
    // CodeMirror (the editor)
    MutationObserver: dom.window.MutationObserver,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    getSelection: dom.window.getSelection.bind(dom.window),
    Window: dom.window.Window,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), // the viewer checks the stage's position
    AbortController: dom.window.AbortController, // the viewer's listeners: jsdom only takes its own AbortSignal
  });
  dom.window.HTMLElement.prototype.setPointerCapture = () => {};
  (dom.window.document as any).createRange = () => ({ setStart() {}, setEnd() {}, getClientRects: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }) });
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
  const lib = { ...(await import("../src/index.js")), ...(await import("../src/entry-editor.js")) };
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

test("Wireframe: the image's size is the SVG's, even when notes wrap differently than their length suggests", async () => {
  // a notes-only row in a grid: tsquare's boardLayout estimates note heights, measureBoardLayout measures them
  const wide = "WARNING: MANDATORY REVIEW WINDOW MUST MATCH WORKFLOW WWW MMM QA APPROVAL ".repeat(3).trim();
  const text = ["board layout=grid columns=2", '  screen phone "Top"', `  note "${wide}"`, `  note "${wide}"`, '  note "Short"', '  screen phone "Below"'].join("\n");
  const { h, lib, tsquare } = await load();
  const view = await mount(h(lib.Wireframe, { source: text }));
  await until(() => !!view.$("img"), "the board");
  const img = view.$("img") as HTMLImageElement;
  const svg = svgOf(img.getAttribute("src")!);
  const [, w, hh] = svg.match(/^<svg width="(\d+)" height="(\d+)"/)!;
  assert.deepEqual([img.getAttribute("width"), img.getAttribute("height")], [w, hh]);
  assert.notEqual(String(tsquare.boardLayout(tsquare.compileWireframe(text).spec!).height), hh, "the estimate is off for this board");
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

/** A stage with a size (jsdom lays nothing out), then a double-click to fit the board to it (it may have arrived already). */
async function sizeStage(stage: HTMLElement, width = 800, height = 600) {
  const { act } = await load();
  Object.defineProperty(stage, "clientWidth", { value: width });
  Object.defineProperty(stage, "clientHeight", { value: height });
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect;
  await act(async () => { stage.dispatchEvent(new dom.window.MouseEvent("dblclick", { bubbles: true })); });
}
/** Board pixels → the stage's client pixels, from the canvas' transform. */
function toClient(canvas: HTMLElement, bx: number, by: number) {
  const m = canvas.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/);
  assert.ok(m, `transform: ${canvas.style.transform}`);
  const [x, y, scale] = m.slice(1).map(Number);
  return { clientX: x + bx * scale, clientY: y + by * scale };
}
const pointer = (stage: HTMLElement, type: string, at: { clientX: number; clientY: number }) =>
  stage.dispatchEvent(new dom.window.PointerEvent(type, { pointerId: 1, pointerType: "mouse", bubbles: true, ...at }));
/** The center of the element on a line of SIGN_IN, in board pixels. */
async function centerOf(line: number) {
  const { tsquare } = await load();
  const { spec, lines } = tsquare.compileWireframe(SIGN_IN);
  const entry = (await tsquare.measureElements(spec!, lines)).find((e) => e.line === line && e.type !== "Flow") as MeasuredElement;
  const { box } = entry;
  return { entry, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("WireframeViewer: onElementClick gets the element clicked and everything under it; dragging pans instead", async () => {
  const { h, act, lib } = await load();
  const clicks: [string, number, string[]][] = [];
  const view = await mount(h(lib.WireframeViewer, { source: SIGN_IN, onElementClick: (hit, hits) => clicks.push([hit!.type, hit!.line, hits.map((e) => e.type)]) }));
  const stage = view.$(".tsquare-stage")!, canvas = view.$(".tsquare-canvas")!;
  await until(() => !!view.$(".tsquare-canvas img"), "the board");
  await settle(); // the elements arrive with the board; setElements runs in an effect
  await sizeStage(stage);

  const button = await centerOf(11); // button primary lg "Sign in"
  const at = toClient(canvas, button.x, button.y);
  await act(async () => { pointer(stage, "pointerdown", at); pointer(stage, "pointerup", at); });
  assert.deepEqual(clicks, [["Button", 11, ["Button", "Screen", "Board"]]]);

  // a press that moves more than a few pixels is a drag: it pans, and isn't a click
  const moved = { clientX: at.clientX + 30, clientY: at.clientY };
  await act(async () => { pointer(stage, "pointerdown", at); pointer(stage, "pointermove", moved); pointer(stage, "pointerup", moved); });
  assert.equal(clicks.length, 1);

  // empty board, outside the screen: the board itself
  const empty = toClient(canvas, 2, 2);
  await act(async () => { pointer(stage, "pointerdown", empty); pointer(stage, "pointerup", empty); });
  assert.deepEqual(clicks[1], ["Board", 1, ["Board"]]);
  await view.unmount();
});

test("WireframeViewer: hovering outlines the element (dashed) when it's clickable, and onElementHover follows the pointer", async () => {
  const { h, act, lib } = await load();
  const hovers: (string | null)[] = [];
  const props = { source: SIGN_IN, onElementHover: (hit: { type: string } | null) => hovers.push(hit?.type ?? null) };
  const view = await mount(h(lib.WireframeViewer, props));
  const stage = view.$(".tsquare-stage")!, canvas = view.$(".tsquare-canvas")!;
  await until(() => !!view.$(".tsquare-canvas img"), "the board");
  await settle(); // the elements arrive with the board; setElements runs in an effect
  await sizeStage(stage);

  const input = await centerOf(6); // input email "Email"
  await act(async () => pointer(stage, "pointermove", toClient(canvas, input.x, input.y)));
  assert.deepEqual(hovers, ["Input"]);
  assert.equal(view.$(".tsquare-highlight-hover"), null, "no outline: nothing to click (no onElementClick)");

  await view.rerender(h(lib.WireframeViewer, { ...props, onElementClick: () => {} }));
  const heading = await centerOf(4);
  await act(async () => pointer(stage, "pointermove", toClient(canvas, heading.x, heading.y)));
  assert.deepEqual(hovers, ["Input", "Heading"]);
  const outline = view.$$(".tsquare-highlight-hover");
  assert.equal(outline.length, 1);
  assert.deepEqual([outline[0].style.left, outline[0].style.width], [`${heading.entry.box.x}px`, `${heading.entry.box.width}px`], "around the heading, in board pixels");

  await act(async () => { stage.dispatchEvent(new dom.window.PointerEvent("pointerleave", { pointerId: 1 })); });
  assert.deepEqual(hovers, ["Input", "Heading", null]);
  assert.equal(view.$(".tsquare-highlight-hover"), null, "gone when the pointer leaves");

  // no longer clickable (the elements stay, for onElementHover): the outline goes at once
  await act(async () => pointer(stage, "pointermove", toClient(canvas, heading.x, heading.y)));
  assert.equal(view.$$(".tsquare-highlight-hover").length, 1);
  await view.rerender(h(lib.WireframeViewer, props));
  assert.equal(view.$(".tsquare-highlight-hover"), null, "cleared when onElementClick goes");
  await view.unmount();
});

test("WireframeViewer: selected outlines the element on each line; none while the text has problems", async () => {
  const { h, lib } = await load();
  const view = await mount(h(lib.WireframeViewer, { source: SIGN_IN, selected: 11 }));
  const outlines = () => view.$$(".tsquare-highlight-selected");
  await until(() => outlines().length === 1, "the selected outline");
  const button = await centerOf(11);
  assert.equal(outlines()[0].style.top, `${button.entry.box.y}px`);

  await view.rerender(h(lib.WireframeViewer, { source: SIGN_IN, selected: [6, 7] }));
  assert.equal(outlines().length, 2, "a list of lines: one outline each");
  await view.rerender(h(lib.WireframeViewer, { source: SIGN_IN, selected: 8 }));
  assert.equal(outlines().length, 1, "a container: the stack row");
  await view.rerender(h(lib.WireframeViewer, { source: SIGN_IN, selected: 1 }));
  assert.equal(outlines().length, 0, "not the board: it would outline everything");
  await view.rerender(h(lib.WireframeViewer, { source: SIGN_IN, selected: null }));
  assert.equal(outlines().length, 0);

  // with problems, the board shown is the last valid one: its lines no longer match the text
  await view.rerender(h(lib.WireframeViewer, { source: SIGN_IN + '    buton "Oops"\n', selected: 11 }));
  await until(() => !!view.$(".tsquare-note .tsquare-problems"), "the problems");
  assert.ok(view.$(".tsquare-canvas img"), "the last valid board stays");
  assert.equal(outlines().length, 0);
  await view.rerender(h(lib.WireframeViewer, { source: SIGN_IN, selected: 11 }));
  await until(() => outlines().length === 1, "the outline once the text is fixed");
  await view.unmount();
});

test("WireframeViewer: when the text and selected change together (Enter in an editor), the outline waits for the new board", async () => {
  const { h, tsquare, lib } = await load();
  // a line added after line 10 (button "Forgot?"), with the caret on it: line 11 is "Help" in the new
  // text, but "Sign in" in the board still on show until it's redrawn
  const lines = SIGN_IN.split("\n");
  const next = [...lines.slice(0, 10), '      button ghost sm "Help"', ...lines.slice(10)].join("\n");
  const boxOf = async (text: string, line: number) => {
    const { spec, lines: map } = tsquare.compileWireframe(text);
    const entry = (await tsquare.measureElements(spec!, map)).find((e) => e.line === line && e.type !== "Flow") as MeasuredElement;
    return `${entry.box.x},${entry.box.y} ${entry.box.width}x${entry.box.height}`;
  };
  const [forgot, signIn, help] = [await boxOf(SIGN_IN, 10), await boxOf(SIGN_IN, 11), await boxOf(next, 11)];

  const view = await mount(h(lib.WireframeViewer, { source: SIGN_IN, selected: 10 }));
  const outlined = () => view.$$(".tsquare-highlight-selected").map((d) => `${parseFloat(d.style.left)},${parseFloat(d.style.top)} ${parseFloat(d.style.width)}x${parseFloat(d.style.height)}`);
  await until(() => outlined()[0] === forgot, "the Forgot? button outlined");

  // every outline drawn from here on, however quickly the board is redrawn
  const seen: string[] = [];
  const watch = new dom.window.MutationObserver(() => seen.push(...outlined()));
  watch.observe(view.$(".tsquare-canvas")!, { childList: true, subtree: true });
  await view.rerender(h(lib.WireframeViewer, { source: next, selected: 11 }));
  await until(() => outlined()[0] === help, "the Help button outlined once the board is redrawn");
  watch.disconnect();
  assert.ok(!seen.includes(signIn), `never the old board's line 11 (the Sign in button): saw ${JSON.stringify(seen)}`);
  await view.unmount();
});

test("WireframeViewer: a board for older text that lands meanwhile clears the outline instead of leaving the last board's over it", async () => {
  // BoardViewer with the states useBoard goes through, so the order is exact: a board for edit 1
  // lands while the text is already edit 2's (pending), then edit 2's board
  const { h, tsquare } = await load();
  const { BoardViewer } = await import("../src/viewer.js");
  const boardOf = async (text: string) => {
    const { spec, lines } = tsquare.compileWireframe(text);
    const [svg, layout, elements] = await Promise.all([tsquare.renderWireframeSvg(spec!), tsquare.measureBoardLayout(spec!), tsquare.measureElements(spec!, lines)]);
    return { svg, width: layout.width, height: layout.height, items: layout.items, elements };
  };
  const lines = SIGN_IN.split("\n");
  const edit1 = [...lines.slice(0, 2), '    text "Hi"', ...lines.slice(2)].join("\n"); // "Forgot?" moves to line 11, lower on the board
  const edit2 = edit1 + "\n";
  const [board0, board1, board2] = [await boardOf(SIGN_IN), await boardOf(edit1), await boardOf(edit2)];
  const key = (b: { x: number; y: number; width: number; height: number }) => `${b.x},${b.y} ${b.width}x${b.height}`;
  const forgot = (b: typeof board0, line: number) => key((b.elements.find((e) => e.line === line && e.type !== "Flow") as MeasuredElement).box);
  const viewer = (board: typeof board0, pending: boolean, selected: number) => h(BoardViewer, { state: { board, problems: [], pending }, streaming: false, selected });

  const view = await mount(viewer(board0, false, 10));
  const outlined = () => view.$$(".tsquare-highlight-selected").map((d) => key({ x: parseFloat(d.style.left), y: parseFloat(d.style.top), width: parseFloat(d.style.width), height: parseFloat(d.style.height) }));
  assert.deepEqual(outlined(), [forgot(board0, 10)]);

  await view.rerender(viewer(board0, true, 11)); // edit 1 typed: the caret's line moved, the board hasn't
  assert.deepEqual(outlined(), [forgot(board0, 10)], "held while nothing new has landed");
  await view.rerender(viewer(board1, true, 11)); // edit 1's board lands, but the text is edit 2's
  assert.notEqual(forgot(board1, 11), forgot(board0, 10), "the button moved on the new board");
  assert.deepEqual(outlined(), [], "no outline from the board before over this one");
  await view.rerender(viewer(board2, false, 11));
  assert.deepEqual(outlined(), [forgot(board2, 11)], "outlined again once the board matches the text");
  await view.unmount();
});

test("WireframeViewer: while the board is behind the text, clicks aren't reported, and clearing selected clears the outline", async () => {
  const { h, act, tsquare } = await load();
  const { BoardViewer } = await import("../src/viewer.js");
  const { spec, lines } = tsquare.compileWireframe(SIGN_IN);
  const [svg, layout, elements] = await Promise.all([tsquare.renderWireframeSvg(spec!), tsquare.measureBoardLayout(spec!), tsquare.measureElements(spec!, lines)]);
  const board = { svg, width: layout.width, height: layout.height, items: layout.items, elements };
  const clicks: number[] = [];
  const viewer = (pending: boolean, selected: number | null) =>
    h(BoardViewer, { state: { board, problems: [], pending }, streaming: false, selected, onElementClick: (hit) => clicks.push(hit!.line) });

  const view = await mount(viewer(false, 11));
  const stage = view.$(".tsquare-stage")!, canvas = view.$(".tsquare-canvas")!;
  await sizeStage(stage);
  const button = await centerOf(11); // button primary lg "Sign in"
  const click = () => act(async () => { const at = toClient(canvas, button.x, button.y); pointer(stage, "pointerdown", at); pointer(stage, "pointerup", at); });
  await click();
  assert.deepEqual(clicks, [11]);
  assert.equal(view.$$(".tsquare-highlight-selected").length, 1);

  // a line typed above the button: the board still shows the text before, so line 11 is the old text's
  await view.rerender(viewer(true, 11));
  await click();
  assert.deepEqual(clicks, [11], "a click on the board that's behind isn't reported");
  assert.equal(view.$$(".tsquare-highlight-selected").length, 1, "the outline is held");
  await view.rerender(viewer(true, null)); // syncSelection off, or the host clears its selection
  assert.equal(view.$$(".tsquare-highlight-selected").length, 0, "clearing the selection doesn't wait for the board");

  await view.rerender(viewer(false, null)); // caught up
  await click();
  assert.deepEqual(clicks, [11, 11]);
  await view.unmount();
});

test("useBoard measures the elements only when asked (WireframeViewer: with an element prop)", async () => {
  const { h } = await load();
  const { useBoard } = await import("../src/use-board.js");
  const Probe = ({ measure }: { measure: boolean }) => {
    const { board } = useBoard(SIGN_IN, false, undefined, measure);
    return h("output", null, board ? String(board.elements?.length ?? "none") : "");
  };
  const view = await mount(h(Probe, { measure: false }));
  await until(() => !!view.$("output")!.textContent, "the board");
  assert.equal(view.$("output")!.textContent, "none");
  await view.rerender(h(Probe, { measure: true }));
  await until(() => view.$("output")!.textContent !== "none", "the elements");
  assert.ok(Number(view.$("output")!.textContent) > 10);
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
  const sources = ["wireframe", "viewer", "problems", "editor", "playground"].map((f) => readFileSync(new URL(`../src/${f}.tsx`, import.meta.url), "utf8")).join("\n");
  const used = new Set([...sources.matchAll(/\btsquare-[a-z-]+/g)].map((m) => m[0]));
  for (const cls of used) assert.ok(css.includes(`.${cls}`), `.${cls} has styles`);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\{)/g)!.map((s) => s.trim()).filter((s) => s && !s.startsWith("@"));
  for (const selector of rules) assert.match(selector, /^:where\(/, `${selector} is wrapped in :where()`);
  assert.match(css, /:where\(\.dark, \[data-theme="dark"\]\)/);
  assert.match(css, /:where\(\.light, \[data-theme="light"\]\)/);
  for (const v of ["bg", "fg", "muted", "border", "stage", "accent", "accent-fg", "error", "font", "font-mono", "radius"]) assert.ok(css.includes(`var(--tsquare-${v},`), `--tsquare-${v}`);
});

test("WireframeEditor: the text with its accessible name; ref.setText reports through onChange", async () => {
  const { h, act, lib } = await load();
  const React = await import("react");
  const ref = React.createRef<import("../src/entry-editor.js").WireframeEditorHandle>();
  const changes: string[] = [];
  const view = await mount(h(lib.WireframeEditor, { ref, defaultValue: SIGN_IN, onChange: (t: string) => changes.push(t), className: "mine" }));
  assert.equal(view.$(".tsquare-editor")!.className, "tsquare-editor mine");
  assert.equal(view.$(".cm-content")!.getAttribute("aria-label"), "Wireframe text");
  assert.ok(view.$(".cm-lineNumbers"), "line numbers by default");
  assert.equal(ref.current!.getText(), SIGN_IN);
  await act(async () => ref.current!.setText("board\n  screen tablet"));
  assert.deepEqual(changes, ["board\n  screen tablet"]);
  assert.equal(ref.current!.getText(), "board\n  screen tablet");
  await view.unmount();
  assert.equal(view.container.querySelector(".cm-editor"), null, "unmounting removes the editor");
});

test("WireframeEditor: the ref works as soon as it's handed out (a callback ref can focus it and read its text)", async () => {
  const { h, lib } = await load();
  const seen: { text: string; focused: boolean }[] = [];
  const view = await mount(h(lib.WireframeEditor, {
    defaultValue: SIGN_IN,
    ref: (handle: import("../src/entry-editor.js").WireframeEditorHandle | null) => {
      if (!handle) return;
      handle.focus();
      seen.push({ text: handle.getText(), focused: !!document.activeElement?.closest(".cm-editor") });
    },
  }));
  assert.deepEqual(seen, [{ text: SIGN_IN, focused: true }]);
  await view.unmount();
});

test("WireframeEditor: problems underlined after a pause in typing, onProblems with the list, [] once fixed", async () => {
  const { h, act, lib } = await load();
  const React = await import("react");
  const ref = React.createRef<import("../src/entry-editor.js").WireframeEditorHandle>();
  const calls: unknown[] = [];
  const view = await mount(h(lib.WireframeEditor, { ref, defaultValue: SIGN_IN, onProblems: (p: unknown) => calls.push(p) }));
  await settle(400);
  assert.deepEqual(calls, [], "valid starting text: no call");

  await act(async () => ref.current!.setText(BROKEN));
  assert.equal(view.$(".cm-lintRange-error"), null, "not right away (mid-word, it would flash)");
  await until(() => !!view.$(".cm-lintRange-error"), "the underline");
  assert.equal(view.$(".cm-lintRange-error")!.textContent, 'buton "Oops"');
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { line: number }[])[0].line, 3);

  await act(async () => ref.current!.setText(SIGN_IN));
  await until(() => calls.length === 2, "the all-clear");
  assert.deepEqual(calls[1], []);
  assert.equal(view.$(".cm-lintRange-error"), null);
  await view.unmount();
});

test("WireframeEditor: a controlled value replaces the text; autocomplete, lineNumbers and lineWrapping turn off", async () => {
  const { h, lib } = await load();
  const wrapped = await mount(h(lib.WireframeEditor, { defaultValue: "board" }));
  assert.ok(wrapped.$(".cm-content")!.classList.contains("cm-lineWrapping"), "wraps by default");
  await wrapped.unmount();
  const view = await mount(h(lib.WireframeEditor, { value: "board", onChange: () => {}, lineNumbers: false, lineWrapping: false, autocomplete: false, ariaLabel: "Sketch" }));
  assert.equal(view.$(".cm-lineNumbers"), null);
  assert.ok(!view.$(".cm-content")!.classList.contains("cm-lineWrapping"), "lineWrapping: false");
  assert.equal(view.$(".cm-content")!.getAttribute("aria-label"), "Sketch");
  await view.rerender(h(lib.WireframeEditor, { value: "board\n  screen phone", onChange: () => {}, lineNumbers: false, autocomplete: false }));
  assert.equal(view.$(".cm-content")!.textContent, "board  screen phone");
  await view.unmount();
});

test("WireframePlayground: editor and viewer on one text; problems wait for a pause, then underlined and noted", async () => {
  const { h, act, lib } = await load();
  const React = await import("react");
  const ref = React.createRef<import("../src/entry-editor.js").WireframeEditorHandle>();
  const calls: unknown[] = [];
  const view = await mount(h(lib.WireframePlayground, { ref, defaultValue: FLOW, onProblems: (p: unknown) => calls.push(p) }));
  assert.equal(view.$(".tsquare-playground")!.getAttribute("data-layout"), "auto");
  assert.ok(view.$(".tsquare-playground-panes > .tsquare-editor"));
  assert.ok(view.$(".tsquare-playground-panes > .tsquare-viewer"));
  await until(() => !!view.$(".tsquare-canvas img"), "the board");
  assert.equal(view.$$(".tsquare-chips button").length, 4);

  await act(async () => ref.current!.setText(FLOW + "\n  buton"));
  await settle(150);
  assert.equal(view.$(".tsquare-note"), null, "no note while typing");
  assert.equal(view.$(".cm-lintRange-error"), null, "no underline while typing");
  await until(() => !!view.$(".tsquare-note"), "the note after a pause");
  assert.match(view.$(".tsquare-note")!.textContent!, /^1 problem · showing the last valid board$/);
  await until(() => !!view.$(".cm-lintRange-error"), "the underline");
  assert.ok(view.$(".tsquare-stage")!.classList.contains("stale"), "the last good board, dimmed");
  await until(() => calls.length === 1, "onProblems, once the final text is checked");
  assert.match((calls[0] as { message: string }[])[0].message, /unknown component "buton"/);

  await view.rerender(h(lib.WireframePlayground, { ref, defaultValue: FLOW, layout: "column", showProblems: false }));
  assert.equal(view.$(".tsquare-playground")!.getAttribute("data-layout"), "column");
  assert.equal(view.$(".tsquare-note"), null, "showProblems={false}: no note");
  assert.ok(view.$(".cm-lintRange-error"), "the editor still underlines");
  await view.unmount();
});

test("WireframePlayground: clicking an element puts the caret on its line, and the caret's element is outlined; syncSelection={false} turns both off", async () => {
  const { h, act, lib } = await load();
  const React = await import("react");
  const ref = React.createRef<import("../src/entry-editor.js").WireframeEditorHandle>();
  const view = await mount(h(lib.WireframePlayground, { ref, defaultValue: SIGN_IN }));
  const stage = view.$(".tsquare-stage")!, canvas = view.$(".tsquare-canvas")!;
  await until(() => !!view.$(".tsquare-canvas img"), "the board");
  await settle();
  await sizeStage(stage);
  const activeLine = () => view.$(".cm-activeLine")?.textContent?.trim();
  const outlines = () => view.$$(".tsquare-highlight-selected");
  assert.equal(outlines().length, 0, "the caret starts on the board's line: nothing outlined");

  const button = await centerOf(11);
  const at = toClient(canvas, button.x, button.y);
  await act(async () => { pointer(stage, "pointerdown", at); pointer(stage, "pointerup", at); });
  assert.equal(activeLine(), 'button primary lg "Sign in" fullWidth', "the caret on the button's line");
  assert.equal(outlines().length, 1);
  assert.equal(outlines()[0].style.top, `${button.entry.box.y}px`, "the button outlined");

  // the caret moving outlines another element
  await act(async () => ref.current!.goToLine(6));
  const input = await centerOf(6);
  assert.equal(outlines()[0].style.top, `${input.entry.box.y}px`);
  await act(async () => pointer(stage, "pointermove", at));
  assert.equal(view.$$(".tsquare-highlight-hover").length, 1, "hovering outlines too: the board is clickable");

  await view.rerender(h(lib.WireframePlayground, { ref, defaultValue: SIGN_IN, syncSelection: false }));
  assert.equal(outlines().length, 0, "no caret outline");
  assert.equal(view.$$(".tsquare-highlight-hover").length, 0, "nor the hover outline, right away (not once the board is redrawn)");
  await settle(); // the board redrawn without elements
  await act(async () => { pointer(stage, "pointerdown", at); pointer(stage, "pointerup", at); });
  assert.equal(activeLine(), 'input email "Email" placeholder="you@example.com"', "a click no longer moves the caret");
  await view.unmount();
});

test("WireframeEditor: onCursorLine reports the caret's line when it moves to another one", async () => {
  const { h, act, lib } = await load();
  const React = await import("react");
  const ref = React.createRef<import("../src/entry-editor.js").WireframeEditorHandle>();
  const lines: number[] = [];
  const view = await mount(h(lib.WireframeEditor, { ref, defaultValue: SIGN_IN, onCursorLine: (n: number) => lines.push(n) }));
  await act(async () => ref.current!.goToLine(6));
  await act(async () => ref.current!.goToLine(6));
  await act(async () => ref.current!.goToLine(11));
  assert.deepEqual(lines, [6, 11]);
  await view.unmount();
});

test("unmounting a viewer stops it (destroy(): its resize watch, listeners and image)", async () => {
  const { h, lib } = await load();
  const view = await mount(h(lib.WireframeViewer, { source: SIGN_IN }));
  await until(() => !!view.$(".tsquare-canvas img"), "the board");
  const before = disconnected;
  await view.unmount();
  assert.equal(disconnected, before + 1);
});
