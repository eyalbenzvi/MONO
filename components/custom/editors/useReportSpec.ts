import { useEffect, useRef } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import type { EditorState } from "./types";

/**
 * An editor's print, reported to the page whenever it changes (compared by
 * value, so a new object with the same fields reports nothing new), and its
 * preview while it has none (EditorState.preview).
 */
export function useReportSpec(spec: CustomSpec | null, onChange: (state: EditorState) => void, preview?: CustomSpec | null | false) {
  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  const previewKey = usePreviewKey(spec, preview);
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, ...previewOf(previewKey) });
  }, [key, previewKey]);
}

/**
 * The preview to report, as a key ("" for none): only while there's no print, and only once the fields have
 * changed from how the page opened them (until then the page shows the example as it is, not a preview of
 * empty fields, nor of the lines an editor starts with).
 */
export function usePreviewKey(spec: CustomSpec | null, preview?: CustomSpec | null | false): string {
  const key = preview ? JSON.stringify(preview) : "";
  // The first preview there is (a field may wait for the word list first) is the page as opened.
  const first = useRef("");
  const moved = useRef(false);
  if (!first.current) first.current = key;
  else if (key !== first.current) moved.current = true;
  return !spec && moved.current ? key : "";
}
/** A preview key as the page's state. */
export const previewOf = (key: string): Pick<EditorState, "preview"> => (key ? { preview: JSON.parse(key) as CustomSpec } : {});

/** A required field's value for the preview: the example's while it's empty (undefined), else the field's (null when it can't print). */
export const orExample = <T,>(value: T | null | undefined, example: T): T | null => (value === undefined ? example : value);
/** Rows for the preview: each row left empty (undefined) the example's row in its place (its placeholder), when it has one; the caller has checked no row has a problem. */
export const rowsOrExample = <T,>(rows: readonly (T | null | undefined)[], example: readonly T[]): T[] =>
  rows.flatMap((v, i) => (v !== undefined && v !== null ? [v] : v === undefined && i < example.length ? [example[i]] : []));
