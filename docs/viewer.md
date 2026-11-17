# WireframeViewer

`<WireframeViewer>` shows a board people can explore: zoom with the buttons, a pinch or Ctrl/Cmd + scroll, drag to pan, double-click to fit, and select a screen's name to zoom to it. It can also tell you which element was clicked and outline elements: see [Clicking elements](#clicking-elements). Use it where the wireframe is the main thing on screen, such as a design review page or a panel next to a spec.

```tsx
import { WireframeViewer } from "@tsquare-js/react";

export function Review({ text }: { text: string }) {
  return <WireframeViewer source={text} style={{ height: 600 }} />;
}
```

It fills its box, so give it a height. With the stylesheet it's 32rem tall unless you set one (or set `--tsquare-viewer-height`); without the stylesheet, set a height yourself. The board starts fitted to the box.

## Props

| Prop | Default | |
|---|---|---|
| `source` | (required) | The wireframe text. |
| `chips` | `true` | A row of buttons above the board, "All" and one per screen, that zoom to it. Only shown for boards with two or more screens. |
| `zoomControls` | `true` | Zoom out, the zoom level (select it to fit the board) and zoom in, at the top right. |
| `streaming` | `false` | The text is still arriving. See [streaming](chat.md#while-a-reply-streams-in). |
| `showProblems` | `true` | Show the text's problems over the bottom of the board. See [Problems](problems.md). |
| `onProblems` | | Called with the problems when the text has some, and with `[]` once they're fixed. |
| `onElementClick` | | Called with the element clicked, and everything under the point. See [Clicking elements](#clicking-elements). |
| `onElementHover` | | Called when the element under the pointer changes, and with `null` when it leaves the board. |
| `selected` | | Outline the element on this line, or on each line in a list. |
| `onElements` | | Called with every element on the board each time a new board is shown, and with `null` once the text has problems. See [Drawing on the board](#drawing-on-the-board). |
| `className` | | Added to the root, next to `tsquare-viewer`. |
| `style` | | On the root. |

With both `chips` and `zoomControls` off, there's no bar at all: just the board, which can still be zoomed and panned with a trackpad, mouse or touch.

```tsx
import { WireframeViewer } from "@tsquare-js/react";

export function Minimal({ text }: { text: string }) {
  return <WireframeViewer source={text} chips={false} zoomControls={false} />;
}
```

## Clicking elements

With `onElementClick`, a click on the board tells you what was clicked: a button, an input, a screen, a flow arrow. Dragging still pans; only a press that hardly moves counts as a click. Hovered elements get a dashed outline, so people can see what they're about to pick. `selected` outlines elements by their line in the text.

While the board is behind its text (redrawing after an edit, or while a reply streams in), its lines are the older text's, so clicks aren't reported until the new board is shown, and `selected` keeps the outline where it was. Clearing `selected` (`null` or `[]`) takes effect right away.

This example outlines the clicked element and shows its lines, the part of the text you'd hand a model to change:

```tsx
import { useState } from "react";
import { WireframeViewer, type Measured } from "@tsquare-js/react";

export function Pick({ text }: { text: string }) {
  const [picked, setPicked] = useState<Measured | null>(null);
  const block = picked ? text.split("\n").slice(picked.line - 1, picked.endLine).join("\n") : "";
  return (
    <>
      <WireframeViewer
        source={text}
        selected={picked?.line}
        onElementClick={(hit) => setPicked(hit && hit.type !== "Board" ? hit : null)}
      />
      {picked ? <pre>{block}</pre> : null}
    </>
  );
}
```

`onElementClick(hit, hits, event)` gets:

- **`hit`**: what the person most likely meant. A button over a flow arrow gets the button; empty space inside a screen gets the screen; empty board outside the screens gets the board itself (`type: "Board"`). An open menu or tooltip gets the element it belongs to.
- **`hits`**: everything under the point, most likely first, ending with the screen and the board. Use it to skip what you don't want, such as `hits.find((e) => e.type !== "Flow")`.
- **`event`**: the browser's pointer event, for modifier keys (`event.shiftKey` to add to a selection).

Each element has its `line` and `endLine` in the text (its whole block, children included), `type`, `label`, its `#id` if the text gives one, and its `box` on the board. A flow arrow has `type: "Flow"`, `from` and `to`. The full list is in tsquare's [element positions](https://tsquare.dev/docs/element-positions) docs.

`selected` takes a line or a list of lines. A line inside a block, such as a blank line between a stack's children, outlines that block, so you can pass an editor's caret line (see [Next to a viewer](editor.md#next-to-a-viewer)). The board's own line outlines nothing.

Some details:

- **Lines shift when the text changes.** An element picked on line 11 is on line 12 after someone adds a line above it. For anything that has to survive edits, such as a comment pinned to an element, key it by the element's `id` and give the elements you care about one in the text (`button "Save" #save`).
- **When `source` and `selected` change together, the outline waits for the new board.** Until it's drawn, the board on show has the old text's lines, so the new line could name a neighbor (after Enter in an editor, the line below). The outline stays where it was, then moves. If a board for text that has changed since is drawn meanwhile, the outline is cleared instead, since it was drawn on the board before, and comes back with the next board.
- **While the text has problems, nothing is clickable or outlined.** The viewer still shows the last board that worked, but its lines no longer match the text. Clicks pan, and outlines come back once the text is fixed.
- **Measuring costs about one more render**, so the viewer only measures the board when you set `onElementClick`, `onElementHover`, `selected` or `onElements`.
- **The outline color** is the CSS variable `--tsquare-highlight` (see [Styling](styling.md)).

## Drawing on the board

You can put your own marks on the board, such as comment pins, numbered callouts or a text field next to an element. They pan and zoom with the board. They're part of your page, not the board, so they never appear in the PNG or SVG.

Two things make this work:

- **The ref.** It gives you a `WireframeViewerHandle`. Its `layer` is an element over the board, measured in board pixels: render your marks into it with `createPortal`.
- **`onElements`.** It gives you every element on the board with its `box` in the same board pixels, so you know where to put each mark. You don't need to measure the board yourself.

This example puts a pin next to each element that has a comment. Clicking a pin zooms to its element:

```tsx
import { useState } from "react";
import { createPortal } from "react-dom";
import { WireframeViewer, type Measured, type MeasuredElement, type WireframeViewerHandle } from "@tsquare-js/react";

interface Comment {
  element: string; // the element's #id in the text
  text: string;
}

export function Comments({ text, comments }: { text: string; comments: Comment[] }) {
  const [viewer, setViewer] = useState<WireframeViewerHandle | null>(null);
  const [elements, setElements] = useState<Measured[] | null>(null);
  const pins = comments.flatMap((comment) => {
    const el = elements?.find((e): e is MeasuredElement => e.type !== "Flow" && e.id === comment.element);
    return el ? [{ comment, el }] : [];
  });
  return (
    <>
      <WireframeViewer ref={setViewer} source={text} onElements={setElements} />
      {viewer
        ? createPortal(
            pins.map(({ comment, el }) => (
              <button
                key={comment.element}
                title={comment.text}
                onClick={() => viewer.zoomTo(el)}
                style={{ position: "absolute", left: el.box.x + el.box.width - 8, top: el.box.y - 8, pointerEvents: "auto" }}
              >
                💬
              </button>
            )),
            viewer.layer,
          )
        : null}
    </>
  );
}
```

The handle has:

- **`layer`**: the element to portal into. Place marks with `position: absolute` and `left`/`top` in board pixels. It ignores the pointer so the board can still be dragged; give marks that should be clicked `pointer-events: auto`. Clicks and drags that start on them don't pan the board or count as element clicks.
- **`toBoard(clientX, clientY)`**: a point on the page in board pixels. Use it to drop a pin exactly where someone clicked: `onElementClick={(hit, hits, event) => { const at = viewer.toBoard(event.clientX, event.clientY); … }}`.
- **`zoomTo(element)`**: zooms to an element (or any `{ x, y, width, height }` box in board pixels), as the screen chips do. Pass `{ animate: false }` to jump there.

Some details:

- **Use a callback ref** (`ref={setViewer}` with `useState`), as in the example. Changing `chips` or `zoomControls` makes a new viewer, with a new handle and layer; a callback ref re-renders your component with the new one, so your marks move to it. A ref from `useRef` changes without a re-render, and your marks would stay in the old layer.
- **`onElements` fires once per board**, after the board for the current text is drawn: not while a reply streams in, and not for a board that's still behind the text. A new viewer (`chips` or `zoomControls` changed) reports its board again. While the text has problems it gets `null`, because the last board's lines no longer match the text; keep showing your marks on the last entries if you prefer.
- **Key marks by `#id`, not by line.** Lines shift when someone edits the text above an element; an `#id` doesn't. Give the elements people comment on one (`button "Save" #save`), or match by `type` and `label` when the text has none.
- **Marks grow when the board is zoomed in**, since the layer is scaled with it. For marks that keep their size on screen, scale them back with the variable the viewer sets on its canvas: `transform: scale(calc(1 / var(--tsquare-viewer-scale)))`, with `transform-origin` at the point the mark is pinned to.

## When the text changes

The viewer keeps its zoom and position when the board is redrawn at the same size, so editing the text doesn't jump the view. When the board's size changes, or the screen you zoomed to is gone, it fits the board again.
