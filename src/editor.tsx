/**
 * <WireframeEditor>: tsquare's code editor (tsquare/editor, the playground's) in React. Highlighting,
 * autocomplete, problems underlined on their lines as you type.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import { compileWireframe, languageData } from "tsquare";
import { createEditor, type WireframeEditor as EditorInstance } from "tsquare/editor";
import type { Problem } from "./use-board.js";

export interface WireframeEditorProps {
  /** The text, when the app keeps it in state (with onChange). */
  value?: string;
  /** The starting text, when the editor keeps it. */
  defaultValue?: string;
  /** Called with the whole text after every change. */
  onChange?: (text: string) => void;
  /** Called with the problems when the text has some (after a pause in typing), and with [] once they're fixed. */
  onProblems?: (problems: Problem[]) => void;
  /** Autocomplete for components, props, option words, icons and accents. Default true. */
  autocomplete?: boolean;
  /** Line numbers. Default true. */
  lineNumbers?: boolean;
  /** The editable area's accessible name. Default "Wireframe text". */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

/** What a ref to the editor (or the playground) can do. */
export interface WireframeEditorHandle {
  getText(): string;
  /** Replace the whole text, as one step that undo reverts (and onChange reports). */
  setText(text: string): void;
  focus(): void;
  /** Select a line, scroll to it and focus the editor. */
  goToLine(line: number): void;
}

const CHECK_DELAY = 300; // problems wait for a pause in typing

export const WireframeEditor = forwardRef<WireframeEditorHandle, WireframeEditorProps>(function WireframeEditor(
  { onChange, onProblems, ...props },
  ref,
) {
  const [problems, setProblems] = useProblems(props.value ?? props.defaultValue ?? "", onProblems);
  return (
    <EditorCore
      ref={ref}
      {...props}
      issues={problems}
      onChange={(text) => {
        setProblems(text);
        onChange?.(text);
      }}
    />
  );
});

/** Checks the text after a pause in typing; returns the problems to underline and a function that takes new text. */
function useProblems(initial: string, onProblems?: (problems: Problem[]) => void) {
  const [problems, setProblems] = useState<Problem[]>(() => issuesOf(initial));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reported = useRef("[]"); // onProblems fires only on a change, and not for valid text that was always valid
  const callback = useRef(onProblems);
  callback.current = onProblems;
  const report = (p: Problem[]) => {
    const key = JSON.stringify(p);
    if (key !== reported.current) { reported.current = key; callback.current?.(p); }
  };
  useEffect(() => {
    report(problems); // the starting text's
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const check = (text: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const p = issuesOf(text);
      setProblems(p);
      report(p);
    }, CHECK_DELAY);
  };
  return [problems, check] as const;
}

const issuesOf = (text: string): Problem[] => compileWireframe(text).issues.map((i) => ({ line: i.line, message: i.message }));

export interface EditorCoreProps extends Omit<WireframeEditorProps, "onProblems"> {
  /** Problems to underline; undefined keeps the current ones (while the playground waits for typing to pause). */
  issues?: Problem[];
}

/** The editor itself: creates tsquare/editor in a div, keeps it in sync with `value`, underlines `issues`. */
export const EditorCore = forwardRef<WireframeEditorHandle, EditorCoreProps>(function EditorCore(
  { value, defaultValue, onChange, issues, autocomplete = true, lineNumbers = true, ariaLabel, className, style },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorInstance | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    const instance = createEditor(host.current!, {
      doc: value ?? defaultValue ?? "",
      data: autocomplete ? languageData() : undefined,
      lineNumbers,
      ariaLabel,
      onChange: (text) => change.current?.(text),
    });
    editor.current = instance;
    return () => {
      instance.destroy();
      editor.current = null;
    };
    // autocomplete, lineNumbers and ariaLabel are set when the editor is made (remount to change them)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new `value` from the app replaces the text, unless it's what the editor already has (its own change coming back)
  useEffect(() => {
    if (value !== undefined && editor.current && value !== editor.current.getText()) editor.current.setText(value);
  }, [value]);

  useEffect(() => {
    if (issues) editor.current?.setIssues(issues);
  }, [issues]);

  useImperativeHandle(ref, () => ({
    getText: () => editor.current?.getText() ?? "",
    setText: (text) => editor.current?.setText(text),
    focus: () => editor.current?.focus(),
    goToLine: (line) => editor.current?.goToLine(line),
  }), []);

  return <div ref={host} className={["tsquare-editor", className].filter(Boolean).join(" ")} style={style} />;
});
