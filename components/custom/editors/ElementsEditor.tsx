"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { ELEMENTS_LEN, PRODUCT, elementsWordProblem } from "@/lib/custom/specs/elements";
import { missing, nearestSpellable, spellable } from "@/lib/custom/draw/elementsSpell";
import { Field, useLexicon } from "./Field";
import { INPUT, type EditorProps } from "./types";

const cap = (s: string) => s[0] + s.slice(1).toLowerCase();

/** Why the symbols can't spell the word, with the nearest word they can (one letter dropped), in one line. */
function spellProblem(x: string): string {
  const gaps = missing(x);
  const near = nearestSpellable(x, ELEMENTS_LEN[0]);
  const why = gaps.length === 1 ? `No element’s symbol fits the ${gaps[0]}.` : `No element’s symbols fit ${gaps.join(" and ")} here.`;
  return near ? `${why} Try "${cap(near)}".` : why;
}

/** Your Name in Elements: one word, spelled in the symbols as it's typed. A word they can't spell isn't offered. */
export default function ElementsEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "elements" ? arrival.p : null;
  const [text, setText] = useState(cap((a ?? PRODUCT.example).x));
  const lex = useLexicon(!!text.trim());

  const x = text.trim().toUpperCase();
  const problem = x ? elementsWordProblem(text) : null;
  const unspelt = x && !problem && !spellable(x) ? spellProblem(x) : null;
  const refused = x && !problem && lex ? lex.wordsProblem(x) : null;
  const error = !x ? (touched ? "Type a name or a word" : null) : (problem ?? refused ?? unspelt);
  const spec: CustomSpec | null = x && !error && lex ? { t: "elements", v: 1, p: { x } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <Field label="Your name" hint={`${ELEMENTS_LEN[0]} to ${ELEMENTS_LEN[1]} letters, one word`} error={error} htmlFor="make-elements-name">
      <input
        id="make-elements-name"
        value={text}
        maxLength={ELEMENTS_LEN[1] + 4}
        placeholder={made.wordsHint}
        autoComplete="off"
        autoCapitalize="words"
        onChange={(e) => setText(e.target.value)}
        aria-invalid={!!error}
        className={INPUT}
      />
    </Field>
  );
}
