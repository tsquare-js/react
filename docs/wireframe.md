# Wireframe

`<Wireframe>` shows a board as an image: the right choice for a wireframe inside a page, a card, a ticket or a chat message.

```tsx
import { Wireframe } from "@tsquare-js/react";

export function Sketch({ text }: { text: string }) {
  return <Wireframe source={text} />;
}
```

It renders a `<figure class="tsquare-board">` with the board inside as an `<img>`:

- **Size:** the image has the board's own width and height, and never gets wider than its container (it scales down, keeping its proportions). A one-screen phone board is about 400 px wide; a board of several screens is wider and shrinks to fit.
- **Alt text:** "Wireframe: " and the board's title, or "Wireframe" when it has none.
- **Updates:** when `source` changes, the new board replaces the old one once it's drawn (a few milliseconds to a few tens for most boards).

## Props

| Prop | Default | |
|---|---|---|
| `source` | (required) | The wireframe text. |
| `expandable` | `false` | Adds a button in the top right corner, and makes the image clickable, to open the board full size in the [viewer](viewer.md), in a dialog. Close it with the × button or Esc. |
| `streaming` | `false` | The text is still arriving, as from a model. See [streaming](chat.md#while-a-reply-streams-in). |
| `showProblems` | `true` | List the text's problems under the board. See [Problems](problems.md). |
| `onProblems` | | Called with the problems when the text has some, and with `[]` once they're fixed. See [Problems](problems.md). |
| `className` | | Added to the `<figure>`, next to `tsquare-board`. |
| `style` | | On the `<figure>`. |

## Open it full size

Multi-screen boards get small in a narrow column. `expandable` lets people open them full size, with zoom, pan and a button per screen:

```tsx
import { Wireframe } from "@tsquare-js/react";

export function FlowSketch({ text }: { text: string }) {
  return <Wireframe source={text} expandable />;
}
```

The full-size view is a native `<dialog class="tsquare-dialog">`: it traps focus while open, closes with Esc, and returns focus where it was.

## When the text has mistakes

If the text isn't valid tsquare, the component lists each problem with its line number, and a "did you mean" when there's a close match:

```text
1 problem in this wireframe
• line 3: unknown component "buton" (did you mean button?)
```

If the text was valid before, the last good board stays above the list, dimmed. To handle problems yourself instead, see [Problems](problems.md).
