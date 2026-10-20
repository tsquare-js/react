/**
 * react-markdown: its `pre` component, so ```tsquare blocks become boards and other code blocks
 * stay as they were. The same `components` shape works in renderers built on react-markdown.
 */
import type { ComponentProps, ReactNode } from "react";
import type { Problem } from "./use-board.js";
import { Wireframe } from "./wireframe.js";

export interface TsquareComponentsOptions {
  /** Each board gets a button that opens it full size, zoomable. Default false. */
  expandable?: boolean;
  /** Show each block's problems under it. Default true. */
  showProblems?: boolean;
  /**
   * Called for a block whose complete text has problems, with the problems and the block's text
   * (to tell blocks apart, or to send both back to the model that wrote them); with [] once fixed.
   */
  onProblems?: (problems: Problem[], source: string) => void;
}

type HastNode = { type: string; value?: string; tagName?: string; properties?: { className?: unknown }; children?: HastNode[] };
const textOf = (n: HastNode): string => n.value ?? (n.children ?? []).map(textOf).join("");
const isTsquare = (className: unknown) =>
  (Array.isArray(className) ? className : String(className ?? "").split(" ")).includes("language-tsquare");

/** The wireframe text in a markdown code block (react-markdown's <pre>), or null for another language. */
function tsquareSource(node: HastNode | undefined, children: ReactNode): string | null {
  const code = node?.children?.find((c) => c.tagName === "code");
  if (code) return isTsquare(code.properties?.className) ? textOf(code) : null;
  // without the hast node: the <code> React element react-markdown puts inside
  const el = (Array.isArray(children) ? children[0] : children) as { props?: { className?: string; children?: unknown } } | undefined;
  if (el?.props && isTsquare(el.props.className)) return [el.props.children].flat().join("");
  return null;
}

/**
 * react-markdown's `pre` with these options. Make it once, outside your components (or with
 * useMemo): a new one on every render would remount every board.
 */
export function createTsquareComponents(options: TsquareComponentsOptions = {}) {
  const { onProblems, ...props } = options;
  function TsquarePre({ node, ...rest }: ComponentProps<"pre"> & { node?: unknown }) {
    const raw = tsquareSource(node as HastNode | undefined, rest.children);
    if (raw == null) return <pre {...rest} />;
    const source = raw.replace(/\n$/, "");
    return <Wireframe source={source} {...props} onProblems={onProblems ? (p) => onProblems(p, source) : undefined} />;
  }
  return { pre: TsquarePre };
}

/** For react-markdown: `<Markdown components={tsquareComponents}>`, or spread it next to your own components. */
export const tsquareComponents = createTsquareComponents();

/** react-markdown's `pre` with the default options, for when you already override `pre`. */
export const TsquarePre = tsquareComponents.pre;
