# WireframePlayground

`<WireframePlayground>` puts the [editor](editor.md) and the [viewer](viewer.md) side by side on one text: type on the left, see the board on the right. It's the tsquare.dev playground's core, for your own app, without the site's menus.

```tsx
import { WireframePlayground } from "@tsquare-js/react/editor";

const START = `board "Sign in"
  screen phone
    stack gap=12 padding=24
      text lg bold "Welcome back"
      input "Email"
      button primary "Sign in" fullWidth`;

export function SketchPad() {
  return <WireframePlayground defaultValue={START} />;
}
```

With the stylesheet it's 36rem tall (or set a height, or `--tsquare-playground-height`). The editor and the board share it evenly, side by side or stacked.

## Props

| Prop | Default | |
|---|---|---|
| `value` | | The text, when your app keeps it in state. Pass `onChange` too. |
| `defaultValue` | | The starting text, when the playground keeps it. |
| `onChange` | | Called with the whole text after every change. |
| `onProblems` | | Called with the problems when the text has some, after a pause in typing, and with `[]` once they're fixed. |
| `layout` | `"auto"` | `"row"`: editor left, board right. `"column"`: editor above the board. `"auto"`: a row when the playground is at least 900px wide, a column below that (narrower, side by side would leave the editor too little room for its lines). |
| `showProblems` | `true` | The note on the board counting the problems. The editor underlines them either way. |
| `chips` | `true` | A chip per screen above the board. |
| `zoomControls` | `true` | Zoom out, zoom level and zoom in above the board. |
| `linkBoard` | `true` | Click an element on the board to put the editor's caret on its line, and outline the element at the caret. See [Clicking the board](#clicking-the-board). |
| `autocomplete` | `true` | Autocomplete in the editor. |
| `lineNumbers` | `true` | Line numbers in the editor. |
| `lineWrapping` | `true` | Wrap long lines in the editor instead of scrolling sideways. |
| `className` | | Added to the root, next to `tsquare-playground`. |
| `style` | | On the root. |

A `ref` gets the editor's methods (`getText`, `setText`, `focus`, `goToLine`), as on [WireframeEditor](editor.md#control-it-from-your-code).

## While someone types

The board redraws every 200 ms or so with the latest text that's valid, so it keeps up without redrawing on every key. Problems wait for a pause: about 400 ms after the last key, the text is checked, problems are underlined in the editor, and a note on the board counts them: "2 problems · showing the last valid board", with that board dimmed. `onProblems` fires then, not while typing.

## Clicking the board

Click an element on the board, and the editor selects its line. Move the caret in the editor, and the element on that line is outlined on the board. A line inside a block (a blank line between a stack's children, say) outlines the block. Hovering the board outlines what a click would pick, dashed. While you type, the outline stays put until the board is redrawn with your change, so it never jumps to a neighbor whose line just moved.

While the text has problems, the board shows the last valid version, whose lines no longer match the text: clicks pan and nothing is outlined until the problems are fixed.

Turn it off with `linkBoard={false}`, for example where the board is only a preview. Linking measures where every element is drawn, which costs about one more render each time the board is redrawn; off, it costs nothing.

```tsx
import { WireframePlayground } from "@tsquare-js/react/editor";

export function Preview({ text }: { text: string }) {
  return <WireframePlayground defaultValue={text} linkBoard={false} />;
}
```

## Saving the text

Keep the text in your state to save it, share it or load another:

```tsx
import { useEffect, useState } from "react";
import { WireframePlayground } from "@tsquare-js/react/editor";

export function SavedSketch({ id, initial }: { id: string; initial: string }) {
  // keyed by id: another sketch gets fresh state, instead of saving this one's text under its id
  return <Sketch key={id} id={id} initial={initial} />;
}

function Sketch({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(() => localStorage.getItem(`sketch:${id}`) ?? initial);
  useEffect(() => { localStorage.setItem(`sketch:${id}`, text); }, [id, text]);
  return <WireframePlayground value={text} onChange={setText} layout="row" />;
}
```
