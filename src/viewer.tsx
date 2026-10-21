/**
 * The zoomable board: tsquare's viewer (the playground's) inside React. Zoom with the buttons, a
 * pinch or Ctrl/Cmd + scroll; drag to pan; a chip per screen zooms to it.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { createViewer, type Viewer } from "tsquare/viewer";
import { MinusIcon, PlusIcon } from "./icons.js";
import { ProblemList } from "./problems.js";
import { useStreaming } from "./streaming.js";
import { problemCount, useBoard, type BoardState, type Problem } from "./use-board.js";

export interface WireframeViewerProps {
  /** The wireframe text. */
  source: string;
  /** True while the text is still arriving (see <Wireframe>). Inside <WireframeStreaming>, it defaults to that value. */
  streaming?: boolean;
  /** A chip per screen that zooms to it (boards with two or more screens). Default true. */
  chips?: boolean;
  /** Zoom out, zoom level (selecting it fits the board) and zoom in. Default true. */
  zoomControls?: boolean;
  /** Show the text's problems over the board. Default true. */
  showProblems?: boolean;
  /** Called with the problems when the complete text has some, and with [] once they're fixed. */
  onProblems?: (problems: Problem[]) => void;
  className?: string;
  style?: CSSProperties;
}

export function WireframeViewer({ source, streaming, onProblems, ...rest }: WireframeViewerProps) {
  const isStreaming = useStreaming(streaming);
  const state = useBoard(source, isStreaming, onProblems);
  // chips and zoomControls decide which elements the viewer is given: a change makes a new viewer
  return <BoardViewer key={`${rest.chips !== false}${rest.zoomControls !== false}`} state={state} streaming={isStreaming} {...rest} />;
}

export interface BoardViewerProps extends Omit<WireframeViewerProps, "source" | "streaming" | "onProblems"> {
  state: BoardState;
  streaming: boolean;
  /** "list": every problem (the default); "summary": one line, for when an editor shows them by line. */
  problemsAs?: "list" | "summary";
}

/** The viewer for board state rendered elsewhere (the playground shares it with its editor; <Wireframe>'s expanded view with its image). */
export function BoardViewer({ state, streaming, chips = true, zoomControls = true, showProblems = true, problemsAs = "list", className, style }: BoardViewerProps) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const screens = useRef<HTMLDivElement>(null);
  const zoomIn = useRef<HTMLButtonElement>(null);
  const zoomOut = useRef<HTMLButtonElement>(null);
  const zoomFit = useRef<HTMLButtonElement>(null);
  const viewer = useRef<Viewer | null>(null);

  useEffect(() => {
    viewer.current = createViewer({
      stage: stage.current!,
      canvas: canvas.current!,
      screens: screens.current!,
      zoomIn: zoomIn.current,
      zoomOut: zoomOut.current,
      zoomFit: zoomFit.current,
    });
    return () => {
      viewer.current?.destroy(); // its listeners, the resize watch, the board image
      viewer.current = null;
    };
  }, []);

  const { board, problems } = state;
  useEffect(() => {
    if (!board || !viewer.current) return;
    viewer.current.show(board.svg, board.width, board.height, board.items);
    const img = canvas.current!.querySelector("img");
    if (img) img.alt = board.title ? `Wireframe: ${board.title}` : "Wireframe";
  }, [board]);

  const visible = showProblems && problems.length > 0 && !streaming;
  useEffect(() => { viewer.current?.setStale(visible && !!board); }, [visible, board]);

  return (
    <div className={["tsquare-viewer", className].filter(Boolean).join(" ")} style={style} aria-busy={state.pending || undefined}>
      {chips || zoomControls ? (
        <div className="tsquare-viewer-bar">
          {/* the viewer fills these: chips (buttons with aria-pressed) and the zoom level */}
          <div ref={screens} className="tsquare-chips" aria-label="Zoom to a screen" hidden={!chips} />
          {zoomControls ? (
            <div className="tsquare-zoom">
              <button ref={zoomOut} type="button" className="tsquare-zoom-out" aria-label="Zoom out"><MinusIcon /></button>
              <button ref={zoomFit} type="button" className="tsquare-zoom-level" aria-label="Fit to the window" />
              <button ref={zoomIn} type="button" className="tsquare-zoom-in" aria-label="Zoom in"><PlusIcon /></button>
            </div>
          ) : null}
        </div>
      ) : (
        <div ref={screens} hidden />
      )}
      <div ref={stage} className="tsquare-stage">
        <div ref={canvas} className="tsquare-canvas" />
      </div>
      {visible ? (
        <div className="tsquare-note">
          {problemsAs === "list" ? (
            <ProblemList problems={problems} />
          ) : (
            <div className="tsquare-problems-title" role="note">
              {problemCount(problems.length).replace(" in this wireframe", "")}
              {board ? " · showing the last valid board" : ""}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
