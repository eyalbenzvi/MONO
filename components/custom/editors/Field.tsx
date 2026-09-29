"use client";

import { useEffect, useState } from "react";
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

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string | null; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 flex items-baseline gap-2 text-xs font-medium text-neutral-400">
        {label}
        {hint && <span className="text-neutral-500">{hint}</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-neutral-300">{error}</p>}
    </div>
  );
}

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
  // A refusal shows at once (it's not a typo to finish); the character rule once the field is left.
  const error = refused ?? (lex && value === null && (left || text.length >= WORDS_INPUT_MAX) ? upTo(WORDS_INPUT_MAX) : null);
  // Still checking (the word list is loading): neither a print nor an error yet.
  const pending = !!text.trim() && !lex;
  return { text, setText, value, error, pending, touch: () => setLeft(true) };
}

export function WordsField({ words, hint, touched }: { words: ReturnType<typeof useWords>; hint: string; touched?: boolean }) {
  return (
    <Field label="Your words" hint="optional" error={words.error ?? (touched && words.value === null && !words.pending ? upTo(WORDS_INPUT_MAX) : null)} htmlFor="make-words">
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
