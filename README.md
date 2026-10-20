# @tsquare-js/react

React components for [tsquare](https://tsquare.dev) wireframes: show a board from wireframe text, let people zoom and pan it, edit it in a playground, and render the ```` ```tsquare ```` blocks in a model's replies, even while they're still streaming in. Boards are drawn in the browser; nothing is sent anywhere.

```bash
npm install @tsquare-js/react
```

```tsx
import Markdown from "react-markdown";
import { WireframeStreaming, createTsquareComponents } from "@tsquare-js/react";
import "@tsquare-js/react/styles.css";

const components = createTsquareComponents({ expandable: true });

export function Reply({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <WireframeStreaming value={streaming}>
      <Markdown components={components}>{text}</Markdown>
    </WireframeStreaming>
  );
}
```

## Docs

[tsquare.dev/docs/react](https://tsquare.dev/docs/react), also in [`docs/`](docs/README.md):

- [Wireframe](docs/wireframe.md): a board as an image, with an optional full-size view
- [WireframeViewer](docs/viewer.md): zoom, pan and a button per screen
- [WireframeEditor](docs/editor.md): write and edit wireframe text, with autocomplete and problems underlined
- [WireframePlayground](docs/playground.md): the editor and the board side by side
- [Markdown and chat](docs/chat.md): react-markdown, streaming replies
- [Problems](docs/problems.md): showing them, or sending them back to the model
- [Styling](docs/styling.md): the stylesheet, your colors, light and dark, class names

Development and releases: [CONTRIBUTING.md](CONTRIBUTING.md). MIT license.
