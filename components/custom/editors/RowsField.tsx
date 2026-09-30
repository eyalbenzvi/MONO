"use client";

import { Field } from "./Field";
import { INPUT } from "./types";

/** A column of a row: a printed text, a year, or a choice. */
export interface Column {
  key: string;
  label: string;
  /** "text" (the default), "year" (four figures), "time" (hh:mm), "date" (the browser's day picker) or a list of choices. */
  kind?: "text" | "year" | "time" | "date" | readonly { value: string; label: string }[];
  max?: number;
  placeholder?: string;
  /** Its share of the row's width (a CSS grid track, "1fr" by default). */
  width?: string;
  /** Our lines, offered as the cell is typed in (a datalist). */
  suggestions?: readonly string[];
}

export type Row = Record<string, string>;

/**
 * Rows of a few fields each (an edition and its year, a role and a name),
 * with Add and Remove, and Up to reorder: the later products' lists. Each
 * cell's error is the caller's (errors[i][key]).
 */
export function RowsField({ id, noun, columns, rows, setRows, min = 1, max, errors, placeholders }: {
  id: string;
  /** What a row is ("edition"): "Add an edition", "Remove edition 2". */
  noun: string;
  columns: Column[];
  rows: Row[];
  setRows: (rows: Row[]) => void;
  min?: number;
  max: number;
  errors: Record<string, string | null>[];
  /** Each row's placeholders (the example's rows), by index. */
  placeholders?: Row[];
}) {
  const set = (i: number, key: string, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const move = (i: number) => setRows(rows.map((r, j) => (j === i - 1 ? rows[i] : j === i ? rows[i - 1] : r)));
  const blank = Object.fromEntries(columns.map((c) => [c.key, Array.isArray(c.kind) ? c.kind[0].value : ""]));
  const article = /^[aeiou]/i.test(noun) ? "an" : "a";
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="grid items-end gap-2" style={{ gridTemplateColumns: `${columns.map((c) => c.width ?? "1fr").join(" ")} auto` }}>
          {columns.map((c) => {
            const cid = `${id}-${c.key}${i}`;
            const err = errors[i]?.[c.key] ?? null;
            const label = `${c.label} ${i + 1}`;
            return (
              <Field key={c.key} label={label} error={err} htmlFor={cid}>
                {Array.isArray(c.kind) ? (
                  <select id={cid} value={r[c.key]} onChange={(e) => set(i, c.key, e.target.value)} className={INPUT}>
                    {c.kind.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={cid}
                    type={c.kind === "date" ? "date" : undefined}
                    list={c.suggestions ? `${id}-${c.key}-ours` : undefined}
                    value={r[c.key] ?? ""}
                    inputMode={c.kind === "year" ? "numeric" : undefined}
                    maxLength={c.kind === "year" ? 4 : c.kind === "time" ? 5 : (c.max ?? 24) + 4}
                    placeholder={c.kind === "time" ? "18:30" : (placeholders?.[i]?.[c.key] ?? c.placeholder)}
                    autoComplete="off"
                    onChange={(e) => set(i, c.key, e.target.value)}
                    aria-invalid={!!err}
                    className={INPUT}
                  />
                )}
              </Field>
            );
          })}
          <div className="flex h-11 items-center gap-3 text-xs">
            {i > 0 && (
              <button type="button" onClick={() => move(i)} aria-label={`Move ${noun} ${i + 1} up`} className="text-neutral-300 underline underline-offset-4 hover:text-white">
                Up
              </button>
            )}
            {rows.length > min && (
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${noun} ${i + 1}`} className="text-neutral-300 underline underline-offset-4 hover:text-white">
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
      {columns.map(
        (c) =>
          c.suggestions && (
            <datalist key={c.key} id={`${id}-${c.key}-ours`}>
              {c.suggestions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          ),
      )}
      {rows.length < max && (
        <button type="button" onClick={() => setRows([...rows, blank])} className="h-10 w-fit text-sm text-neutral-300 underline underline-offset-4 hover:text-white">
          Add {article} {noun}
        </button>
      )}
    </div>
  );
}

/** A year typed in a row: the year, undefined when empty, null when it isn't one in range. */
export const yearOf = (s: string, lo: number, hi: number): number | null | undefined => {
  if (!s.trim()) return undefined;
  const y = /^\d{4}$/.test(s.trim()) ? Number(s.trim()) : NaN;
  return y >= lo && y <= hi ? y : null;
};
