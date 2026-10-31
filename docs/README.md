# React

`@tsquare-js/react` draws [tsquare](https://tsquare.dev) wireframes in React apps. Boards are drawn in the browser by the tsquare library; nothing is sent anywhere.

```bash
npm install @tsquare-js/react
```

```tsx
import "@tsquare-js/react/styles.css";
```

The stylesheet is optional but recommended: it styles the buttons, problem lists and viewer, follows your app's light or dark theme, and takes your colors through CSS variables. See [Styling](styling.md).

## Which component

| You want to… | Use |
|---|---|
| Show a wireframe as an image in a page or card | [`<Wireframe>`](wireframe.md) |
| Let people zoom, pan and jump between screens | [`<WireframeViewer>`](viewer.md), or `<Wireframe expandable>` to open it full size from the image |
| Let people click an element, or outline one | [`<WireframeViewer>`](viewer.md#clicking-elements) with `onElementClick` and `selected` |
| Let people write or edit wireframe text | [`<WireframeEditor>`](editor.md), from `@tsquare-js/react/editor` |
| An editor and the board side by side | [`<WireframePlayground>`](playground.md), from `@tsquare-js/react/editor` |
| Show the ```` ```tsquare ```` blocks in Markdown you render with react-markdown, such as a model's replies in a chat | [`tsquareComponents`](chat.md) |
| Show a reply while it's still streaming in | [`<WireframeStreaming>`](chat.md#while-a-reply-streams-in) |
| Handle invalid wireframes yourself, for example by sending the problems back to the model | [`onProblems`](problems.md) |

## A first example

```tsx
import { Wireframe } from "@tsquare-js/react";
import "@tsquare-js/react/styles.css";

const SIGN_IN = `board "Sign in"
  screen phone
    stack gap=12 padding=24
      text lg bold "Welcome back"
      input "Email"
      input password "Password"
      button primary "Sign in" fullWidth`;

export function SignInSketch() {
  return <Wireframe source={SIGN_IN} expandable />;
}
```

The board fits its container's width and keeps its proportions. `expandable` adds a button that opens it full size, zoomable.

## How it works

Each component turns the wireframe text into an SVG in the browser with the tsquare library's browser build (your bundler picks it automatically) and shows it as an image. The text is checked first: if it has mistakes, the component lists them by line instead, under the last version that worked. The components are client components (`"use client"`); on the server they render an empty frame, filled in once the page loads.

The renderer adds about 1.7 MB minified (490 KB compressed) to your bundle. The editor and playground live in their own entry point, `@tsquare-js/react/editor`, because they add CodeMirror (another 125 KB or so); apps that only show boards never load it. If wireframes are an occasional thing in your app, load the component when it's first needed:

```tsx
import { lazy, Suspense } from "react";

const Wireframe = lazy(() => import("@tsquare-js/react").then((m) => ({ default: m.Wireframe })));

export function MaybeSketch({ source }: { source: string }) {
  return (
    <Suspense fallback={null}>
      <Wireframe source={source} />
    </Suspense>
  );
}
```

The wireframe language itself, every component and prop, is in the [tsquare docs](https://tsquare.dev/docs/language).
