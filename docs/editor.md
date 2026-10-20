# WireframeEditor

`<WireframeEditor>` is tsquare's code editor for writing wireframes: the one in the [playground](https://tsquare.dev/playground). It highlights the language, autocompletes components, props, option words, icons and accents, and underlines problems on their lines. Use it where people edit wireframe text, for example to adjust what a model wrote; for the editor and the board side by side, use the [playground](playground.md).

```tsx
import { useState } from "react";
import { WireframeEditor } from "@tsquare-js/react";

export function EditSketch({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  return <WireframeEditor value={text} onChange={setText} />;
}
```

The editor fills its box, so give it a height: with the stylesheet it's 20rem unless you set one (or `--tsquare-editor-height`).

## Props

| Prop | Default | |
|---|---|---|
| `value` | | The text, when your app keeps it in state. Pass `onChange` too. |
| `defaultValue` | | The starting text, when the editor keeps it. |
| `onChange` | | Called with the whole text after every change. |
| `onProblems` | | Called with the problems when the text has some, after a pause in typing, and with `[]` once they're fixed. See [Problems](problems.md). |
| `autocomplete` | `true` | Suggestions for components, props, option words, icons and accents as you type (Ctrl+Space to ask). |
| `lineNumbers` | `true` | Line numbers in a gutter. |
| `ariaLabel` | `"Wireframe text"` | The editable area's accessible name. |
| `className` | | Added to the root, next to `tsquare-editor`. |
| `style` | | On the root. |

`autocomplete`, `lineNumbers` and `ariaLabel` are read when the editor is created; give the component a new `key` to change them later.

## What it does as you type

- **Problems:** about 300 ms after you stop typing, the text is checked, and each problem is underlined on its line, with its message when you hover the line or its gutter marker. Nothing flashes while you're mid-word.
- **Enter** keeps the indentation of the line above, so nesting stays easy.
- **Pasting a whole model reply** keeps just its ```` ```tsquare ```` block.
- **Undo, search** (Cmd/Ctrl+F) and the usual editing keys work as in any code editor.

## Control it from your code

A `ref` gets the editor's methods, for a "Load example" button or jumping to a problem:

```tsx
import { useRef } from "react";
import { WireframeEditor, type WireframeEditorHandle } from "@tsquare-js/react";

export function EditorWithExample({ example }: { example: string }) {
  const editor = useRef<WireframeEditorHandle>(null);
  return (
    <>
      <button onClick={() => editor.current?.setText(example)}>Load the example</button>
      <WireframeEditor ref={editor} defaultValue="" />
    </>
  );
}
```

| Method | |
|---|---|
| `getText()` | The current text. |
| `setText(text)` | Replace everything, as one step undo reverts; `onChange` reports it. |
| `focus()` | Put the cursor in the editor. |
| `goToLine(n)` | Select line `n`, scroll to it and focus the editor. |

## Bundle size

The editor is built on CodeMirror, bundled inside tsquare (about 125 KB compressed after minifying, on top of the renderer). It doesn't share CodeMirror with the rest of your app and takes no CodeMirror extensions. If only some pages edit wireframes, load it when it's first needed (`lazy()` or a dynamic `import()`).

Colors and fonts follow the [stylesheet's variables](styling.md); the highlighting has its own (`--tsquare-syntax-*`).
