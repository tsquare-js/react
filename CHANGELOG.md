# Changelog

## 0.5.0

- **Click elements in `<WireframeViewer>`:** `onElementClick(hit, hits, event)` gets the element or flow arrow clicked (a press that hardly moves; dragging still pans) and everything under the point, most likely first, each with its lines in the text, type, label, `#id` and box. Hovered elements get a dashed outline. `onElementHover` follows the pointer. `selected` outlines the element on a line, or on each line in a list (a line inside a block, such as an editor's caret, outlines that block). When the text and `selected` change together, the outline waits for the new board instead of matching the new line against the old one. The outline color is `--tsquare-highlight`. Built on tsquare 0.14's viewer events.
- **The board is measured only when it's needed:** the viewer measures every element (about one more render) only with `onElementClick`, `onElementHover` or `selected`. Other boards cost the same as before.
- **While the text has problems, nothing is clickable or outlined:** the last valid board's lines no longer match the text.
- **`<WireframePlayground>` syncs the selection between the board and the text:** click an element to select its line in the editor; move the caret and its element is outlined on the board. On by default; `syncSelection={false}` turns it off (and skips measuring the board).
- **`<WireframeEditor onCursorLine>`:** the caret's line when it moves to another one, to connect your own editor and viewer (`selected`, `goToLine`).
- The `Measured` types (`Measured`, `MeasuredElement`, `MeasuredFlow`, `MeasuredBox`) are exported from `@tsquare-js/react`.
- **Needs tsquare 0.14.0 or later.**
- **Docs:** the WireframeViewer page has a Clicking elements section, the Playground page Clicking the board, the Editor page Next to a viewer; Styling lists `--tsquare-highlight` and the outline classes.

## 0.4.0

- **Needs tsquare 0.13.2 or later** (it was 0.12.1). Boards get tsquare's renderer fixes from 0.12.3 to 0.13.2.
- **A board's image size and its viewer's screen chips are exact** on boards with notes: they come from tsquare's `measureBoardLayout`, which measures notes as drawn. `boardLayout`'s estimate could be a line or more off for a note that wraps differently than its length suggests, so the image was scaled into a slightly wrong box and the chips zoomed to the wrong place.

## 0.3.1

- **Works with tsquare 0.13** as well as 0.12 (from 0.12.1). An app that installs tsquare 0.13 now shares one copy with this package instead of getting a second one. Nothing else changed; the tests pass on both 0.12.1 and 0.13.0.

## 0.3.0

- **The editor and playground are imported from `@tsquare-js/react/editor`,** their own entry point, because they bundle CodeMirror (about 125 KB compressed): apps that import only `@tsquare-js/react` (boards, viewer, react-markdown) don't get it.
- **`<WireframeEditor>`:** tsquare's code editor (the playground's): highlighting, autocomplete, problems underlined about 300 ms after typing stops, Enter keeping the indentation, a whole pasted model reply trimmed to its code block, long lines wrapped (continuing 4 spaces past their indentation). `value`/`defaultValue`, `onChange`, `onProblems`, `autocomplete`, `lineNumbers`, `lineWrapping`, `ariaLabel`; a `ref` gets `getText`, `setText`, `focus` and `goToLine`. Built on `tsquare/editor` (tsquare 0.12), with CodeMirror bundled inside it.
- **`<WireframePlayground>`:** the editor and the viewer side by side on one text, half and half (stacked below 900px, or `layout="row"`/`"column"`). While someone types, the board redraws every 200 ms or so and problems wait; after a pause they're underlined in the editor and counted in a note on the board.
- **The viewer stops when it unmounts** (tsquare's new `destroy()`): no listeners, resize watching or board image left behind.
- **Styles** for the editor (its colors from the `--tsquare-*` theme; highlighting from `--tsquare-syntax-*`) and the playground; `--tsquare-editor-height`, `--tsquare-playground-height`.
- **Docs:** Editor and Playground pages; the overview's table and Styling cover them.
- Needs tsquare 0.12.1 or later.

## 0.2.0

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
