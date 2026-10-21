/**
 * React components for tsquare wireframes. Boards are drawn in the browser by tsquare; nothing is
 * sent anywhere. Styles: import "@tsquare-js/react/styles.css" (optional; see docs/styling.md).
 * The editor and playground are in "@tsquare-js/react/editor" (entry-editor.ts), so apps that only
 * show boards don't bundle CodeMirror.
 */
export { Wireframe, type WireframeProps } from "./wireframe.js";
export { WireframeViewer, type WireframeViewerProps } from "./viewer.js";
export { WireframeStreaming } from "./streaming.js";
export { tsquareComponents, createTsquareComponents, TsquarePre, type TsquareComponentsOptions } from "./markdown.js";
export type { Problem } from "./use-board.js";
