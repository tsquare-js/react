/**
 * <WireframePlayground>: the editor and the viewer side by side (stacked when narrow), sharing one
 * text. While someone types, the board redraws every 200 ms or so and problems wait; after a pause
 * they're underlined in the editor and counted in a note on the viewer. With syncSelection (the
 * default), clicking an element puts the caret on its line, and the caret's element is outlined.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import { EditorCore, type WireframeEditorHandle } from "./editor.js";
import { useBoard, type Problem } from "./use-board.js";
import { BoardViewer } from "./viewer.js";

export interface WireframePlaygroundProps {
  /** The text, when the app keeps it in state (with onChange). */
  value?: string;
  /** The starting text, when the playground keeps it. */
  defaultValue?: string;
  /** Called with the whole text after every change. */
  onChange?: (text: string) => void;
  /** Called with the problems when the text has some (after a pause in typing), and with [] once they're fixed. */
  onProblems?: (problems: Problem[]) => void;
  /** "row": editor left, board right. "column": editor above the board. "auto" (default): row when the playground is at least 900px wide, column below that. */
  layout?: "auto" | "row" | "column";
  /** The note on the board counting the problems ("2 problems · showing the last valid board"). Default true; the editor underlines them either way. */
  showProblems?: boolean;
  /** A chip per screen above the board. Default true. */
  chips?: boolean;
  /** Zoom out, zoom level and zoom in above the board. Default true. */
  zoomControls?: boolean;
  /** Click an element on the board to put the editor's caret on its line, and outline the element at the caret. Default true. */
  syncSelection?: boolean;
  /** Autocomplete in the editor. Default true. */
  autocomplete?: boolean;
  /** Line numbers in the editor. Default true. */
  lineNumbers?: boolean;
  /** Wrap long lines in the editor instead of scrolling sideways. Default true. */
  lineWrapping?: boolean;
  className?: string;
  style?: CSSProperties;
}

const TYPING_PAUSE = 400;

export const WireframePlayground = forwardRef<WireframeEditorHandle, WireframePlaygroundProps>(function WireframePlayground(
  { value, defaultValue, onChange, onProblems, layout = "auto", showProblems = true, chips = true, zoomControls = true, syncSelection = true, autocomplete, lineNumbers, lineWrapping, className, style },
  ref,
) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const text = value ?? inner;
  const typing = useTyping(text);
  const state = useBoard(text, typing, onProblems, syncSelection); // syncing the selection needs the elements measured
  const [caret, setCaret] = useState<number | null>(null);
  const editor = useRef<WireframeEditorHandle>(null);
  useImperativeHandle(ref, () => ({
    getText: () => editor.current?.getText() ?? "",
    setText: (t) => editor.current?.setText(t),
    focus: () => editor.current?.focus(),
    goToLine: (line) => editor.current?.goToLine(line),
  }), []);
  // underline once the text has been checked after a pause; meanwhile keep the current underlines
  const issues = typing || state.pending ? undefined : state.problems;
  return (
    <div className={["tsquare-playground", className].filter(Boolean).join(" ")} data-layout={layout} style={style}>
      <div className="tsquare-playground-panes">
        <EditorCore
          ref={editor}
          value={value}
          defaultValue={defaultValue}
          onChange={(t) => {
            setInner(t);
            onChange?.(t);
          }}
          onCursorLine={setCaret}
          issues={issues}
          autocomplete={autocomplete}
          lineNumbers={lineNumbers}
          lineWrapping={lineWrapping}
        />
        <BoardViewer
          key={`${chips}${zoomControls}`}
          state={state}
          streaming={typing}
          chips={chips}
          zoomControls={zoomControls}
          showProblems={showProblems}
          problemsAs="summary"
          // the caret's move outlines the element (onCursorLine → selected)
          onElementClick={syncSelection ? (hit) => { if (hit && hit.type !== "Board") editor.current?.goToLine(hit.line); } : undefined}
          selected={syncSelection ? caret : null}
        />
      </div>
    </div>
  );
});

/** True from a change in the text until TYPING_PAUSE ms without one (not for the starting text). */
function useTyping(text: string) {
  const [typing, setTyping] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setTyping(true);
    const timer = setTimeout(() => setTyping(false), TYPING_PAUSE);
    return () => clearTimeout(timer);
  }, [text]);
  return typing;
}
