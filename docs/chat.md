# Markdown and chat

In a chat app, a model's replies are usually Markdown, rendered with [react-markdown](https://github.com/remarkjs/react-markdown). When a reply contains a ```` ```tsquare ```` code block, `tsquareComponents` turns it into a board; every other code block renders as it did before.

```tsx
import Markdown from "react-markdown";
import { tsquareComponents } from "@tsquare-js/react";

export function Reply({ text }: { text: string }) {
  return <Markdown components={tsquareComponents}>{text}</Markdown>;
}
```

To combine it with your own components, spread it:

```tsx
import Markdown from "react-markdown";
import { tsquareComponents } from "@tsquare-js/react";

export function Reply({ text }: { text: string }) {
  return (
    <Markdown components={{ ...tsquareComponents, a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>
      {text}
    </Markdown>
  );
}
```

`tsquareComponents` replaces react-markdown's `pre`. If you already override `pre` (say, for syntax highlighting), call `TsquarePre` for tsquare blocks and keep your own for the rest; `TsquarePre` renders a plain `<pre>` for any other language:

```tsx
import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import { TsquarePre } from "@tsquare-js/react";

function MyPre({ node, ...props }: ComponentProps<"pre"> & { node?: any }) {
  const lang = node?.children?.[0]?.properties?.className?.[0];
  if (lang === "language-tsquare") return <TsquarePre node={node} {...props} />;
  return <pre className="my-code" {...props} />;
}

export function Reply({ text }: { text: string }) {
  return <Markdown components={{ pre: MyPre }}>{text}</Markdown>;
}
```

## Options for every board

`createTsquareComponents` takes the same options as `<Wireframe>`, applied to every block:

```tsx
import Markdown from "react-markdown";
import { createTsquareComponents } from "@tsquare-js/react";

// once, outside your components: a new set on every render would redraw every board
const components = createTsquareComponents({ expandable: true });

export function Reply({ text }: { text: string }) {
  return <Markdown components={components}>{text}</Markdown>;
}
```

| Option | Default | |
|---|---|---|
| `expandable` | `false` | Each board gets a button that opens it full size. |
| `showProblems` | `true` | Show each block's problems under it. |
| `onProblems` | | `(problems, source)`: called for a block whose complete text has problems, with the block's text so you know which one; `[]` once fixed. See [Problems](problems.md). |

## While a reply streams in

While a reply is still arriving, its last code block is unfinished, and its last line is often half-written. Wrap the reply in `<WireframeStreaming>` and set `value` while text is still coming:

```tsx
import Markdown from "react-markdown";
import { WireframeStreaming, tsquareComponents } from "@tsquare-js/react";

export function Reply({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <WireframeStreaming value={streaming}>
      <Markdown components={tsquareComponents}>{text}</Markdown>
    </WireframeStreaming>
  );
}
```

While `value` is true:

- the board redraws every 200 ms or so with the latest text that's valid, so it fills in as the reply arrives;
- half-written lines don't flash problems: problems wait until the reply is complete, and `onProblems` isn't called;
- the board isn't dimmed between updates.

When `value` turns false, the text is checked once more: if it's valid you get the final board; if not, its problems show (or go to `onProblems`).

Most chat libraries tell you whether a message is still streaming. With the Vercel AI SDK's `useChat`, for example, it's the last message while `status === "streaming"`. `<WireframeStreaming>` sets `streaming` for every board inside it; you can also pass `streaming` to a `<Wireframe>` directly.

## Other Markdown renderers

`tsquareComponents` works with react-markdown and with renderers built on it that take the same `components` prop. For anything else, render `<Wireframe source={…} />` yourself for code blocks whose language is `tsquare`.
