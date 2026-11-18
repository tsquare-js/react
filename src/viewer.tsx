/**
 * The zoomable board: tsquare's viewer (the playground's) inside React. Zoom with the buttons, a
 * pinch or Ctrl/Cmd + scroll; drag to pan; a chip per screen zooms to it. With onElementClick,
 * onElementHover, selected or onElements, the board's elements are measured too, and the viewer
 * reports clicks and outlines elements. The ref (WireframeViewerHandle) hands out the viewer's layer,
 * for the host's own marks on the board (comment pins), with toBoard and zoomTo.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import { elementsAtLine } from "tsquare";
import { createViewer, type Measured, type MeasuredBox, type Viewer } from "tsquare/viewer";
import { useClientLayoutEffect } from "./client-layout-effect.js";
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
  /**
   * Called with every element and flow on the board (their lines, type, label, #id and box) each
   * time a new board is shown, and with null when the text then has problems. Not while streaming.
   */
  onElements?: (elements: Measured[] | null) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * What the ref of a <WireframeViewer> gives you, for drawing your own marks on the board. A new
 * viewer (chips or zoomControls changed) comes with a new handle and layer: a callback ref
 * (`ref={setViewer}` with useState) follows it.
 */
export interface WireframeViewerHandle {
  /**
   * An element over the board, in board pixels (where the elements' boxes are): it pans and zooms
   * with the board. Portal your marks into it. It ignores the pointer; give marks that should be
   * clickable `pointer-events: auto`. It's on the page once the first board is shown.
   */
  readonly layer: HTMLElement;
  /** A point on the page (a pointer event's clientX/clientY) in board pixels. */
  toBoard(clientX: number, clientY: number): { x: number; y: number };
  /** Zooms to an element's box (a flow: its line and label) or any box in board pixels. */
  zoomTo(target: Measured | MeasuredBox, options?: { animate?: boolean }): void;
}

export const WireframeViewer = forwardRef<WireframeViewerHandle, WireframeViewerProps>(function WireframeViewer({ source, streaming, onProblems, ...rest }, ref) {
  const isStreaming = useStreaming(streaming);
  // measuring every element is another render's worth of work: only when something uses it
  const measure = !!(rest.onElementClick || rest.onElementHover || rest.selected != null || rest.onElements);
  const state = useBoard(source, isStreaming, onProblems, measure);
  // chips and zoomControls decide which elements the viewer is given: a change makes a new viewer
  return <BoardViewer ref={ref} key={`${rest.chips !== false}${rest.zoomControls !== false}`} state={state} streaming={isStreaming} {...rest} />;
});

export interface BoardViewerProps extends Omit<WireframeViewerProps, "source" | "streaming" | "onProblems"> {
  state: BoardState;
  streaming: boolean;
  /** "list": every problem (the default); "summary": one line, for when an editor shows them by line. */
  problemsAs?: "list" | "summary";
}

/** The viewer for board state rendered elsewhere (the playground shares it with its editor; <Wireframe>'s expanded view with its image). */
export const BoardViewer = forwardRef<WireframeViewerHandle, BoardViewerProps>(function BoardViewer({ state, streaming, chips = true, zoomControls = true, showProblems = true, problemsAs = "list", onElementClick, onElementHover, selected, onElements, className, style }, ref) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const screens = useRef<HTMLDivElement>(null);
  const zoomIn = useRef<HTMLButtonElement>(null);
  const zoomOut = useRef<HTMLButtonElement>(null);
  const zoomFit = useRef<HTMLButtonElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const { board, problems } = state;
  // The elements, while the board matches the text: with problems, the board is the last valid one
  // and its lines no longer match the text.
  const elements = problems.length ? null : board?.elements ?? null;
  // While the board is behind the text (typing, streaming), its lines are the older text's.
  const behind = state.pending && !!elements;
  // the viewer is made once: its callbacks read the latest props
  const props = useRef({ onElementClick, onElementHover, behind });
  props.current = { onElementClick, onElementHover, behind };
  const elementsCallback = useRef(onElements);
  elementsCallback.current = onElements;

  // Made in a layout effect, which runs before useImperativeHandle below hands out the ref, so the
  // handle holds this viewer's layer from the start.
  useClientLayoutEffect(() => {
    viewer.current = createViewer({
      stage: stage.current!,
      canvas: canvas.current!,
      screens: screens.current!,
      zoomIn: zoomIn.current,
      zoomOut: zoomOut.current,
      zoomFit: zoomFit.current,
    }, {
      // not while the board is behind: the hit's line would be the older text's (the editor would go to a neighbor)
      onElementClick: (hit, hits, event) => { if (!props.current.behind) props.current.onElementClick?.(hit, hits, event); },
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

  useImperativeHandle(ref, () => {
    const v = viewer.current!;
    return {
      layer: v.layer,
      toBoard: (clientX, clientY) => v.toBoard(clientX, clientY),
      zoomTo: (target, options) => v.zoomTo(target, options),
    };
  }, []);

  useEffect(() => {
    if (!board || !viewer.current) return;
    viewer.current.show(board.svg, board.width, board.height, board.items);
    const img = canvas.current!.querySelector("img");
    if (img) img.alt = board.title ? `Wireframe: ${board.title}` : "Wireframe";
  }, [board]);

  useEffect(() => {
    viewer.current?.setElements(elements);
    viewer.current?.highlight([], { kind: "hover" });
  }, [elements]);

  // onElements: the entries once the board matches the text (a board still behind it, such as the
  // last one drawn mid-stream when the stream ends, isn't reported); null once the text has problems;
  // nothing mid-stream. undefined = nothing reported yet, so text with problems from the start still
  // gets its null. A callback added later gets the current entries (reset while there's none); a
  // callback replaced by another doesn't. A board drawn before measuring was asked for has no entries
  // yet: it waits for the measured one instead of reporting null.
  const reportedElements = useRef<Measured[] | null | undefined>(undefined);
  const settled = !streaming && !state.pending;
  const measured = problems.length > 0 || !!board?.elements;
  const subscribed = !!onElements;
  useEffect(() => {
    if (!subscribed) { reportedElements.current = undefined; return; }
    if (!settled || !measured || elements === reportedElements.current) return;
    reportedElements.current = elements;
    elementsCallback.current?.(elements);
  }, [elements, settled, measured, subscribed]);

  // no longer clickable: no hover outline (new ones aren't drawn; this clears the one showing)
  const clickable = !!onElementClick;
  useEffect(() => { if (!clickable) viewer.current?.highlight([], { kind: "hover" }); }, [clickable]);

  // While the board is behind, a line from the new text (an editor's caret after Enter) would pick a
  // neighbor, so the outline stays put until the board catches up. A board for older text that lands
  // meanwhile clears it: the outline was drawn on the board before and doesn't fit this one. So does
  // clearing `selected`, which needs no lines matched.
  const lines = selected == null ? "" : [selected].flat().join(",");
  const outlinedOn = useRef<Measured[] | null>(null);
  useEffect(() => {
    if (behind) {
      if (elements !== outlinedOn.current || !lines) viewer.current?.highlight([]);
      outlinedOn.current = elements;
      return;
    }
    const outlined = !elements || !lines ? [] : lines.split(",").map((n) => elementsAtLine(elements, Number(n))[0]).filter((e) => e && e.type !== "Board");
    viewer.current?.highlight(outlined);
    outlinedOn.current = elements;
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
});
