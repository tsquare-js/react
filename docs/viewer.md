# WireframeViewer

`<WireframeViewer>` shows a board people can explore: zoom with the buttons, a pinch or Ctrl/Cmd + scroll, drag to pan, double-click to fit, and select a screen's name to zoom to it. Use it where the wireframe is the main thing on screen, such as a design review page or a panel next to a spec.

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
| `className` | | Added to the root, next to `tsquare-viewer`. |
| `style` | | On the root. |

With both `chips` and `zoomControls` off, there's no bar at all: just the board, which can still be zoomed and panned with a trackpad, mouse or touch.

```tsx
import { WireframeViewer } from "@tsquare-js/react";

export function Minimal({ text }: { text: string }) {
  return <WireframeViewer source={text} chips={false} zoomControls={false} />;
}
```

## When the text changes

The viewer keeps its zoom and position when the board is redrawn at the same size, so editing the text doesn't jump the view. When the board's size changes, or the screen you zoomed to is gone, it fits the board again.
