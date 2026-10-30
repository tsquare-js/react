/**
 * The zoomable board: tsquare's viewer (the playground's) inside React. Zoom with the buttons, a
 * pinch or Ctrl/Cmd + scroll; drag to pan; a chip per screen zooms to it. With onElementClick,
 * onElementHover or selected, the board's elements are measured too, and the viewer reports clicks
 * and outlines elements.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { elementsAtLine } from "tsquare";
import { createViewer, type Measured, type Viewer } from "tsquare/viewer";
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
  /**
   * Called when someone clicks the board (a press that hardly moves; dragging pans) with the element
   * or flow they most likely meant, and everything under the point, most likely first. On empty board
   * outside the screens, `hit` is the board itself (`type: "Board"`). Hovered elements get a dashed outline.
   */
  onElementClick?: (hit: Measured | null, hits: Measured[], event: PointerEvent) => void;
  /** Called when the element under the pointer changes, and with null when the pointer leaves the board. */
  onElementHover?: (hit: Measured | null, hits: Measured[]) => void;
  /** Outline the element on this line (or on each of these lines), such as the one clicked or the one at an editor's caret. */
  selected?: number | number[] | null;
  className?: string;
  style?: CSSProperties;
}

export function WireframeViewer({ source, streaming, onProblems, ...rest }: WireframeViewerProps) {
  const isStreaming = useStreaming(streaming);
  // measuring every element is another render's worth of work: only when something uses it
  const measure = !!(rest.onElementClick || rest.onElementHover || rest.selected != null);
  const state = useBoard(source, isStreaming, onProblems, measure);
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
export function BoardViewer({ state, streaming, chips = true, zoomControls = true, showProblems = true, problemsAs = "list", onElementClick, onElementHover, selected, className, style }: BoardViewerProps) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const screens = useRef<HTMLDivElement>(null);
  const zoomIn = useRef<HTMLButtonElement>(null);
  const zoomOut = useRef<HTMLButtonElement>(null);
  const zoomFit = useRef<HTMLButtonElement>(null);
  const viewer = useRef<Viewer | null>(null);
  // the viewer is made once: its callbacks read the latest props
  const props = useRef({ onElementClick, onElementHover });
  props.current = { onElementClick, onElementHover };

  useEffect(() => {
    viewer.current = createViewer({
      stage: stage.current!,
      canvas: canvas.current!,
      screens: screens.current!,
      zoomIn: zoomIn.current,
      zoomOut: zoomOut.current,
      zoomFit: zoomFit.current,
    }, {
      onElementClick: (hit, hits, event) => props.current.onElementClick?.(hit, hits, event),
      onElementHover: (hit, hits) => {
        if (props.current.onElementClick) viewer.current?.highlight(hit && hit.type !== "Board" ? [hit] : [], { kind: "hover" });
        props.current.onElementHover?.(hit, hits);
      },
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

  // The elements, while the board matches the text: with problems, the board is the last valid one
  // and its lines no longer match the text.
  const elements = problems.length ? null : board?.elements ?? null;
  useEffect(() => {
    viewer.current?.setElements(elements);
    viewer.current?.highlight([], { kind: "hover" });
  }, [elements]);

  // no longer clickable: no hover outline (new ones aren't drawn; this clears the one showing)
  const clickable = !!onElementClick;
  useEffect(() => { if (!clickable) viewer.current?.highlight([], { kind: "hover" }); }, [clickable]);

  // While the board is behind the text (typing, streaming), its lines are the older text's: a line
  // from the new text (an editor's caret after Enter) would pick a neighbor, so the outline stays put
  // until the board catches up.
  const lines = selected == null ? "" : [selected].flat().join(",");
  const behind = state.pending && !!elements;
  useEffect(() => {
    if (behind) return;
    const outlined = !elements || !lines ? [] : lines.split(",").map((n) => elementsAtLine(elements, Number(n))[0]).filter((e) => e && e.type !== "Board");
    viewer.current?.highlight(outlined);
  }, [elements, lines, behind]);

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
