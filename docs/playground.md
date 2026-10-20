# WireframePlayground

`<WireframePlayground>` puts the [editor](editor.md) and the [viewer](viewer.md) side by side on one text: type on the left, see the board on the right. It's the tsquare.dev playground's core, for your own app, without the site's menus.

```tsx
import { WireframePlayground } from "@tsquare-js/react";

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

With the stylesheet it's 36rem tall (or set a height, or `--tsquare-playground-height`). The editor takes two fifths of the width and the board three.

## Props

| Prop | Default | |
|---|---|---|
| `value` | | The text, when your app keeps it in state. Pass `onChange` too. |
| `defaultValue` | | The starting text, when the playground keeps it. |
| `onChange` | | Called with the whole text after every change. |
| `onProblems` | | Called with the problems when the text has some, after a pause in typing, and with `[]` once they're fixed. |
| `layout` | `"auto"` | `"row"`: editor left, board right. `"column"`: editor above the board. `"auto"`: a row when the playground is at least 640px wide, a column below that. |
| `showProblems` | `true` | The note on the board counting the problems. The editor underlines them either way. |
| `chips` | `true` | A chip per screen above the board. |
| `zoomControls` | `true` | Zoom out, zoom level and zoom in above the board. |
| `autocomplete` | `true` | Autocomplete in the editor. |
| `lineNumbers` | `true` | Line numbers in the editor. |
| `className` | | Added to the root, next to `tsquare-playground`. |
| `style` | | On the root. |

A `ref` gets the editor's methods (`getText`, `setText`, `focus`, `goToLine`), as on [WireframeEditor](editor.md#control-it-from-your-code).

## While someone types

The board redraws every 200 ms or so with the latest text that's valid, so it keeps up without redrawing on every key. Problems wait for a pause: about 400 ms after the last key, the text is checked, problems are underlined in the editor, and a note on the board counts them: "2 problems · showing the last valid board", with that board dimmed. `onProblems` fires then, not while typing.

## Saving the text

Keep the text in your state to save it, share it or load another:

```tsx
import { useEffect, useState } from "react";
import { WireframePlayground } from "@tsquare-js/react";

export function SavedSketch({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(() => localStorage.getItem(`sketch:${id}`) ?? initial);
  useEffect(() => { localStorage.setItem(`sketch:${id}`, text); }, [id, text]);
  return <WireframePlayground value={text} onChange={setText} layout="row" />;
}
```
