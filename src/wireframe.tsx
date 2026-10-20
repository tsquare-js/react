/**
 * <Wireframe>: the board as an image, sized to fit its container, with its problems listed under
 * it. `expandable` adds a button that opens it full size in the zoomable viewer.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CloseIcon, ExpandIcon } from "./icons.js";
import { ProblemList } from "./problems.js";
import { useStreaming } from "./streaming.js";
import { useBoard, type Problem } from "./use-board.js";
import { BoardViewer } from "./viewer.js";

export interface WireframeProps {
  /** The wireframe text. */
  source: string;
  /**
   * True while the text is still arriving, as when a model's reply streams in: the board updates
   * every 200 ms or so with the latest text that's valid, and problems wait until the text is
   * complete. Inside <WireframeStreaming>, it defaults to that value.
   */
  streaming?: boolean;
  /** A button (and selecting the board) opens it full size, zoomable, in a dialog. Default false. */
  expandable?: boolean;
  /** Show the text's problems under the board. Default true. */
  showProblems?: boolean;
  /** Called with the problems when the complete text has some, and with [] once they're fixed. */
  onProblems?: (problems: Problem[]) => void;
  className?: string;
  style?: CSSProperties;
}

export function Wireframe({ source, streaming, expandable = false, showProblems = true, onProblems, className, style }: WireframeProps) {
  const isStreaming = useStreaming(streaming);
  const state = useBoard(source, isStreaming, onProblems);
  const { board, problems } = state;
  const src = useMemo(() => (board ? svgDataUrl(board.svg) : null), [board]);
  const visible = showProblems && problems.length > 0 && !isStreaming;
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const classes = ["tsquare-board", visible && board ? "tsquare-stale" : "", className].filter(Boolean).join(" ");
  const alt = board?.title ? `Wireframe: ${board.title}` : "Wireframe";
  return (
    <figure className={classes} style={style} aria-busy={state.pending || undefined}>
      {board && src ? (
        <img
          className="tsquare-board-image"
          src={src}
          width={board.width}
          height={board.height}
          alt={alt}
          // sizing, so the board fits its container even without the stylesheet
          style={{ maxWidth: "100%", height: "auto" }}
          onClick={expandable ? () => setOpen(true) : undefined}
        />
      ) : null}
      {expandable && board ? (
        <button type="button" className="tsquare-expand" aria-label="Open full size" onClick={() => setOpen(true)}>
          <ExpandIcon />
        </button>
      ) : null}
      {visible ? <ProblemList problems={problems} /> : null}
      {expandable ? (
        <dialog ref={dialog} className="tsquare-dialog" aria-label={alt} onClose={() => setOpen(false)}>
          <div className="tsquare-dialog-header">
            <span className="tsquare-dialog-title">{board?.title ?? "Wireframe"}</span>
            <button type="button" className="tsquare-dialog-close" aria-label="Close" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          {open ? <BoardViewer state={state} streaming={isStreaming} showProblems={showProblems} /> : null}
        </dialog>
      ) : null}
    </figure>
  );
}

/** The SVG inside the URL itself: nothing to release when the image goes away. */
function svgDataUrl(svg: string) {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
