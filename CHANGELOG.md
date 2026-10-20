# Changelog

## Unreleased

- **`<WireframeViewer>`:** the board to explore: zoom (buttons, pinch, Ctrl/Cmd + scroll), pan, double-click to fit, and a chip per screen that zooms to it. `chips` and `zoomControls` turn each part off.
- **`<Wireframe expandable>`:** a button (and selecting the board) opens it full size in the viewer, in a native dialog.
- **`onProblems`:** called with the problems (`{ line, message }`) when the complete text has some, and with `[]` once fixed; never mid-stream. With `showProblems={false}` the app handles them, for example by sending them back to the model with tsquare's `repairPrompt`. In react-markdown, `createTsquareComponents({ onProblems })` also gets each block's text.
- **`createTsquareComponents(options)`:** `expandable`, `showProblems` and `onProblems` for every board in react-markdown.
- **Styles:** `import "@tsquare-js/react/styles.css"`. Colors, fonts and corners come from `--tsquare-*` CSS variables; light and dark follow the page's color scheme or a `dark`/`light` class or `data-theme`; every rule is wrapped in `:where()`, so the app's CSS wins without `!important`. The components no longer use inline styles, except the board image's `max-width: 100%; height: auto`.
- **The board image is a `data:` URL** instead of a `blob:` URL: nothing to release when it goes away.
- **Docs** in `docs/` (also on tsquare.dev/docs/react), every example typechecked by the tests, every prop checked to be documented.

## 0.1.0

- `<Wireframe source>`: a board from wireframe text, drawn in the browser; problems listed by line.
- `tsquareComponents` / `TsquarePre` for react-markdown: ```` ```tsquare ```` blocks become boards.
- Streaming: `<WireframeStreaming value>` (or `streaming` on `<Wireframe>`) keeps the board current every 200 ms or so while a reply arrives, and holds problems back until it's complete.
