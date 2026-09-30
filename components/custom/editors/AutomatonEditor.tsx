"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { AUTOMATON_MAX, AUTOMATON_RULES, PRODUCT, automatonWordProblem, type Params } from "@/lib/custom/specs/automaton";
import { Field, useLexicon } from "./Field";
import { Segmented, Switch } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Your Automaton: the word (its ASCII bits are the first row), the rule, dots or squares. */
export default function AutomatonEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "automaton" ? arrival.p : null;
  const start = a ?? PRODUCT.example;
  const [text, setText] = useState(start.x);
  const [rule, setRule] = useState<Params["r"]>(start.r);
  const [squares, setSquares] = useState(start.s === 1);
  const lex = useLexicon(!!text.trim());

  const x = text.replace(/\s+/g, " ").trim();
  const problem = x ? automatonWordProblem(text) : null;
  const refused = x && !problem && lex ? lex.wordsProblem(x) : null;
  const error = !x ? (touched ? "Add a name or a word." : null) : (problem ?? refused);
  const spec: CustomSpec | null = x && !error && lex ? { t: "automaton", v: 1, p: { x, r: rule, ...(squares ? { s: 1 as const } : {}) } } : null;

  useReportSpec(spec, onChange);

  return (
    <>
      <Field label="Your word" hint={`up to ${AUTOMATON_MAX} characters`} error={error} htmlFor="make-automaton-word">
        <input id="make-automaton-word" value={text} maxLength={AUTOMATON_MAX + 4} placeholder={made.wordsHint} autoComplete="off" onChange={(e) => setText(e.target.value)} aria-invalid={!!error} className={INPUT} />
      </Field>
      <Segmented label="Rule" options={AUTOMATON_RULES} value={rule} onChange={setRule} />
      <Switch label="Squares instead of dots" checked={squares} onChange={setSquares} />
    </>
  );
}
