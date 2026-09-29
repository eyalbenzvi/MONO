"use client";

import { useState } from "react";
import { cleanWords } from "@/lib/custom/spec";
import { Field, charLine, unprintable, upTo, useLexicon } from "./Field";
import { INPUT } from "./types";

type Lexicon = NonNullable<ReturnType<typeof useLexicon>>;

/**
 * A printed text field's state, for the later products' editors: tidied and
 * checked as typed. `value` is the text to print, undefined when empty, null
 * while it can't be printed (the reason in `error`, once it's worth saying:
 * a refused word or a character at once, the length at once, a missing
 * required field only after a try).
 */
export function useText(initial: string, max: number, lex: Lexicon | null, opts: { required?: string; touched?: boolean } = {}) {
  const [text, setText] = useState(initial);
  const clean = cleanWords(text, max);
  const refused = clean && lex ? lex.wordsProblem(clean) : null;
  const empty = !text.trim();
  const bad = unprintable(text);
  const value = empty ? undefined : clean && lex && !refused ? clean : null;
  const error = empty ? (opts.required && opts.touched ? opts.required : null) : refused ?? (bad ? charLine(bad) : !clean ? upTo(max) : null);
  return { text, setText, value, error, ok: empty ? !opts.required : value !== null && value !== undefined };
}

export type TextState = ReturnType<typeof useText>;

/** A text field for a useText state: a one-line input, or a box for a longer text. */
export function TextField({ id, label, hint, state, max, placeholder, rows, suggestions }: { id: string; label: string; hint?: string; state: TextState; max: number; placeholder?: string; rows?: number; suggestions?: readonly string[] }) {
  const common = { id, list: suggestions ? `${id}-ours` : undefined, value: state.text, maxLength: max + 8, placeholder, autoComplete: "off", onChange: (e: { target: { value: string } }) => state.setText(e.target.value), "aria-invalid": !!state.error };
  return (
    <Field label={label} hint={hint} error={state.error} htmlFor={id}>
      {rows ? <textarea {...common} rows={rows} className={`${INPUT} h-auto py-2 leading-snug`} /> : <input {...common} className={INPUT} />}
      {suggestions && (
        <datalist id={`${id}-ours`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </Field>
  );
}

/** Whether a set of text states can print (each fine, and the lexicon here when any has words). */
export const allOk = (lex: Lexicon | null, ...states: TextState[]) => states.every((s) => s.ok) && (!!lex || states.every((s) => !s.text.trim()));

/** One printed text (a cell in a row), checked as useText checks a field: the text to print (undefined empty, null bad) and why. */
export function checkText(text: string, max: number, lex: Lexicon | null): { value: string | null | undefined; error: string | null } {
  if (!text.trim()) return { value: undefined, error: null };
  const clean = cleanWords(text, max);
  const refused = clean && lex ? lex.wordsProblem(clean) : null;
  const bad = unprintable(text);
  return { value: clean && lex && !refused ? clean : null, error: refused ?? (bad ? charLine(bad) : !clean ? upTo(max) : null) };
}
