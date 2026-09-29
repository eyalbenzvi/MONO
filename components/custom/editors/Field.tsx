"use client";

import { Children, cloneElement, isValidElement, useEffect, useState, type ReactElement } from "react";
import { cleanWords } from "@/lib/custom/spec";
import { INPUT } from "./types";

type Lexicon = typeof import("@/lib/custom/lexicon");
let lexiconLoad: Promise<Lexicon> | null = null;
const loadLexicon = () => (lexiconLoad ??= import("@/lib/custom/lexicon"));

/** The words lexicon, loaded on first use (lib/custom/lexicon); null until it's here. */
export function useLexicon(wanted: boolean): Lexicon | null {
  const [lex, setLex] = useState<Lexicon | null>(null);
  useEffect(() => {
    if (wanted && !lex) loadLexicon().then(setLex);
  }, [wanted, lex]);
  return lex;
}

/**
 * A field: its label, the control, and its error as checkout shows one (a
 * white ring on the control, a marked line, announced, and tied to the
 * control by aria-describedby).
 */
export function Field({ label, hint, error, note, htmlFor, children }: { label: string; hint?: string; error?: string | null; note?: string | null; htmlFor: string; children: React.ReactNode }) {
  const errId = `${htmlFor}-error`;
  const noteId = `${htmlFor}-note`;
  // A single control gets the error tied to it (and marked invalid, which rings it).
  const only = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const control = only && error ? cloneElement(only, { "aria-describedby": errId, "aria-invalid": only.props["aria-invalid"] ?? true }) : only && note ? cloneElement(only, { "aria-describedby": noteId }) : children;
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 flex items-baseline gap-2 text-xs font-medium text-neutral-400">
        {label}
        {hint && <span className="text-neutral-400">{hint}</span>}
      </label>
      {control}
      {error && (
        <p id={errId} role="alert" className="mt-1.5 flex items-start gap-1.5 break-words text-xs font-medium text-white [overflow-wrap:anywhere]">
          <span aria-hidden className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-black">
            !
          </span>
          {error}
        </p>
      )}
      {/* A note is information, not a problem: a quiet line, never marked or announced as an error. */}
      {!error && note && (
        <p id={noteId} className="mt-1.5 break-words text-xs text-neutral-400 [overflow-wrap:anywhere]">
          {note}
        </p>
      )}
    </div>
  );
}

/** The characters a print's words can use (lib/custom/specKit WORDS), one at a time. */
const PRINTABLE_CHAR = /[\p{Script=Latin}0-9 .,'’&:!?·()-]/u;
/** The first character the print can't set, or null. Any space (a non-breaking one pasted in) prints as a plain one, as cleanWords tidies it. */
export const unprintable = (text: string) => [...text.replace(/\s/g, " ")].find((c) => !PRINTABLE_CHAR.test(c)) ?? null;
/** Why a character can't print, naming it (never "too long" for a short word). */
export const charLine = (c: string) => `We can’t print “${c}”. Latin letters, figures and . , ’ & : ! ? · ( ) - only.`;
/** A name or words that can't print: the character that can't, else the length. */
export const nameLine = (text: string, max: number) => {
  const c = unprintable(text);
  return c ? charLine(c) : upTo(max);
};

/** How long "Your words" may be as typed (the specs still read up to WORDS_MAX, so the links already sent keep working). */
export const WORDS_INPUT_MAX = 24;
/** The one line for a name or words that can't print. */
export const upTo = (max: number) => `Up to ${max} letters and numbers.`;

/**
 * "Your words": optional, the print's first line (or its caption). Tidied
 * and checked as typed; `value` is the words to print, undefined when the
 * field is empty, null while they can't be printed (with the reason shown).
 */
export function useWords(initial = "") {
  const [text, setText] = useState(initial);
  const [left, setLeft] = useState(false);
  const lex = useLexicon(!!text.trim());
  const refused = text.trim() && lex ? lex.wordsProblem(text) : null;
  const value = text.trim() ? (refused || !lex ? null : cleanWords(text)) : undefined;
  // A refusal or a character the print hasn't shows at once (neither is a typo to finish); the length once the field is left.
  const bad = unprintable(text);
  const error = refused ?? (bad ? charLine(bad) : null) ?? (lex && value === null && (left || text.length >= WORDS_INPUT_MAX) ? upTo(WORDS_INPUT_MAX) : null);
  // Still checking (the word list is loading): neither a print nor an error yet.
  const pending = !!text.trim() && !lex;
  return { text, setText, value, error, pending, touch: () => setLeft(true) };
}

export function WordsField({ words, hint, touched }: { words: ReturnType<typeof useWords>; hint: string; touched?: boolean }) {
  return (
    <Field label="Your words" hint="optional" error={words.error ?? (touched && words.value === null && !words.pending ? (unprintable(words.text) ? charLine(unprintable(words.text)!) : upTo(WORDS_INPUT_MAX)) : null)} htmlFor="make-words">
      <input
        id="make-words"
        value={words.text}
        maxLength={WORDS_INPUT_MAX}
        placeholder={hint}
        autoComplete="off"
        onChange={(e) => words.setText(e.target.value)}
        onBlur={words.touch}
        aria-invalid={!!words.error}
        className={INPUT}
      />
    </Field>
  );
}
