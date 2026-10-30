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

`selected` takes a line or a list of lines. A line inside a block, such as a blank line between a stack's children, outlines that block, so you can pass an editor's caret line. The board's own line outlines nothing.

Some details:

- **Lines shift when the text changes.** An element picked on line 11 is on line 12 after someone adds a line above it. For anything that has to survive edits, such as a comment pinned to an element, key it by the element's `id` and give the elements you care about one in the text (`button "Save" #save`).
- **While the text has problems, nothing is clickable or outlined.** The viewer still shows the last board that worked, but its lines no longer match the text. Clicks pan, and outlines come back once the text is fixed.
- **Measuring costs about one more render**, so the viewer only measures the board when you set `onElementClick`, `onElementHover` or `selected`.
- **The outline color** is the CSS variable `--tsquare-highlight` (see [Styling](styling.md)).

## When the text changes

The viewer keeps its zoom and position when the board is redrawn at the same size, so editing the text doesn't jump the view. When the board's size changes, or the screen you zoomed to is gone, it fits the board again.
