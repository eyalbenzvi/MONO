import { useEffect, useRef } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import type { EditorState } from "./types";

/**
 * An editor's print, reported to the page whenever it changes (compared by
 * value, so a new object with the same fields reports nothing new).
 */
export function useReportSpec(spec: CustomSpec | null, onChange: (state: EditorState) => void) {
  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);
}
