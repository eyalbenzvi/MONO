"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { CROSS_MAX, CROSS_MIN, PRODUCT, crossNames, crossWordProblem } from "@/lib/custom/specs/crossword";
import { buildCrossword } from "@/lib/custom/draw/crossword";
import { Field, WORDS_INPUT_MAX, useLexicon, useWords } from "./Field";
import { Switch } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

/** The names as typed: split on spaces and commas, in capitals. */
const namesOf = (text: string) => text.toUpperCase().split(/[\s,;]+/).filter(Boolean);

/**
 * Your Crossword: the names (4–12, one word each, A–Z), a title, and whether
 * the grid prints blank with the names listed to fit back in. A name that
 * crosses no other still prints, on its own; the line under the names says which.
 */
export default function CrosswordEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "crossword" ? arrival.p : null;
  const ex = PRODUCT.example;
  const [text, setText] = useState(a ? crossNames(a.x).map((n) => n[0] + n.slice(1).toLowerCase()).join(", ") : "");
  const [blank, setBlank] = useState(a?.h === 1);
  const title = useWords(a?.w ?? "");
  const lex = useLexicon(!!text.trim());

  const names = namesOf(text);
  const bad = names.map((n) => [n, crossWordProblem(n)] as const).find(([, e]) => e);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  const namesError = !names.length
    ? touched
      ? `Type ${CROSS_MIN} to ${CROSS_MAX} names`
      : null
    : bad
      ? `${bad[0]}: ${bad[1]}`
      : dup
        ? `${dup} is there twice. Each name once.`
        : names.length < CROSS_MIN
          ? `At least ${CROSS_MIN} names`
          : names.length > CROSS_MAX
            ? `Up to ${CROSS_MAX} names`
            : lex
              ? lex.wordsProblem(names.join(" "))
              : null;
  const ok = names.length > 0 && !namesError && !!lex;
  const w = title.value;
  const spec: CustomSpec | null = ok && w !== null ? { t: "crossword", v: 1, p: { x: names.join(" "), ...(blank ? { h: 1 as const } : {}), ...(w ? { w } : {}) } } : null;
  // Which names cross nothing (the builder takes tens of milliseconds at most).
  const key = spec ? JSON.stringify(spec) : "";
  const namesKey = ok ? names.join(" ") : "";
  const islands = useMemo(() => (namesKey ? buildCrossword(namesKey.split(" ")).islands : []), [namesKey]);
  const note = islands.length ? `${islands.join(", ")} ${islands.length === 1 ? "crosses" : "cross"} no other name, so ${islands.length === 1 ? "it sits" : "they sit"} on ${islands.length === 1 ? "its" : "their"} own.` : null;

  const report = useRef(onChange);
  report.current = onChange;
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <>
      <Field label="Names" hint={`${CROSS_MIN} to ${CROSS_MAX}, one word each`} error={namesError} note={note} htmlFor="make-crossword-names">
        <input id="make-crossword-names" maxLength={CROSS_MAX * 14} value={text} placeholder={crossNames(ex.x).map((n) => n[0] + n.slice(1).toLowerCase()).join(", ")} autoComplete="off" autoCapitalize="words" onChange={(e) => setText(e.target.value)} aria-invalid={!!namesError} className={INPUT} />
      </Field>
      <Field label="Title" hint="optional" error={title.error} htmlFor="make-crossword-title">
        <input id="make-crossword-title" value={title.text} maxLength={WORDS_INPUT_MAX} placeholder={PRODUCT.wordsHint} autoComplete="off" onChange={(e) => title.setText(e.target.value)} onBlur={title.touch} aria-invalid={!!title.error} className={INPUT} />
      </Field>
      <Switch label="Blank, to solve" checked={blank} onChange={setBlank} />
    </>
  );
}
