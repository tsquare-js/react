/**
 * The rendering shared by every component: wireframe text → the board (SVG, size, screens) or its
 * problems, drawn in the browser by tsquare. While streaming, it draws at most every
 * STREAM_INTERVAL ms and keeps any result newer than what's shown, so a steady stream fills the
 * board in as it goes (waiting for a pause would draw nothing until the stream ends).
 */
import { useEffect, useRef, useState } from "react";
import { compileWireframe, measureBoardLayout, measureElements, renderWireframeSvg, type Measured } from "tsquare";
import type { BoardItem } from "tsquare/viewer";

export interface Problem {
  /** The line in the wireframe text (1-based). */
  line: number;
  message: string;
}

export interface Board {
  svg: string;
  width: number;
  height: number;
  /** Screens and notes with their boxes on the board, for zooming to a screen. */
  items: BoardItem[];
  title?: string;
  /** Every element and flow with its box and lines (measureElements), when asked for: the viewer's clicks and outlines. */
  elements?: Measured[];
}

export interface BoardState {
  /** The last board that compiled (still shown while newer text has problems). */
  board: Board | null;
  /** Problems in the latest checked text; [] when it's valid. */
  problems: Problem[];
  /** Newer text than what's shown hasn't been drawn or checked yet. */
  pending: boolean;
}

const STREAM_INTERVAL = 200;

/** `measure`: also measure every element (a second render's worth of work), for clicks and outlines. */
export function useBoard(source: string, streaming: boolean, onProblems?: (problems: Problem[]) => void, measure = false): BoardState {
  const [state, setState] = useState<BoardState>({ board: null, problems: [], pending: true });
  const seq = useRef(0);
  const shown = useRef(0);
  const lastStart = useRef(0);
  const alive = useRef(true);
  const reported = useRef("[]"); // what onProblems last got, so it fires only on a change
  const callback = useRef(onProblems);
  callback.current = onProblems;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    const mine = ++seq.current;
    setState((s) => (s.pending ? s : { ...s, pending: true }));
    const delay = streaming ? Math.max(0, STREAM_INTERVAL - (Date.now() - lastStart.current)) : 0;
    const timer = setTimeout(() => {
      lastStart.current = Date.now();
      void draw(source, mine);
    }, delay);
    return () => clearTimeout(timer);

    async function draw(text: string, n: number) {
      const apply = (update: (s: BoardState) => BoardState, problems: Problem[]) => {
        if (!alive.current || n < shown.current) return;
        shown.current = n;
        const pending = n !== seq.current;
        setState((s) => ({ ...update(s), pending }));
        // Problems are reported only for complete text: mid-stream, half-written lines are always wrong.
        if (!streaming && !pending) {
          const key = JSON.stringify(problems);
          if (key !== reported.current) { reported.current = key; callback.current?.(problems); }
        }
      };
      const { spec, lines, issues } = compileWireframe(text);
      if (!spec || issues.length) {
        const problems = issues.map((i) => ({ line: i.line, message: i.message }));
        apply((s) => ({ ...s, problems }), problems);
        return;
      }
      try {
        // the exact layout (notes measured as drawn), so the image's size and the screen chips match the SVG
        const [svg, { width, height, items }, elements] = await Promise.all([
          renderWireframeSvg(spec, { skipValidation: true }),
          measureBoardLayout(spec),
          measure ? measureElements(spec, lines, { skipValidation: true }) : undefined,
        ]);
        const title = (spec.elements[spec.root]?.props as { title?: string } | undefined)?.title;
        apply(() => ({ board: { svg, width, height, items, title, elements }, problems: [], pending: false }), []);
      } catch (err) {
        const problems = [{ line: 0, message: `tsquare couldn't render this board: ${err instanceof Error ? err.message : String(err)}` }];
        apply((s) => ({ ...s, problems }), problems);
      }
    }
  }, [source, streaming, measure]);

  return state;
}

/** "1 problem in this wireframe", "2 problems in this wireframe". */
export const problemCount = (n: number) => (n === 1 ? "1 problem in this wireframe" : `${n} problems in this wireframe`);
export const problemLine = (p: Problem) => (p.line ? `line ${p.line}: ${p.message}` : p.message);
