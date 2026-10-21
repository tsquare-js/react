/**
 * @tsquare-js/react/editor: the components that edit wireframe text. A separate entry point because
 * the editor bundles CodeMirror (about 125 KB compressed): apps that only show boards import
 * "@tsquare-js/react" and don't get it. Shares its rendering, viewer and streaming context with the
 * main entry (one copy, in a shared chunk).
 */
export { WireframeEditor, type WireframeEditorProps, type WireframeEditorHandle } from "./editor.js";
export { WireframePlayground, type WireframePlaygroundProps } from "./playground.js";
