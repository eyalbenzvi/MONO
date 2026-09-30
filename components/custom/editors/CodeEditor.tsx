"use client";

import { useState } from "react";
import { CODE_CHARS, CODE_MAX, CODE_NAMES, codeProblem, codeText, type CodeKind, type CustomSpec } from "@/lib/custom/spec";
import { Field, useLexicon } from "./Field";
import { Segmented, Switch } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const KINDS: readonly CodeKind[] = ["card", "tape", "morse", "braille", "binary"];

/** The first character as typed that the code can't carry, and its plain letter (as typed) when that would do. */
function typedProblem(text: string, k: CodeKind): { ch: string; instead: string | null } | null {
  const fits = (c: string) => CODE_CHARS[k].test(k === "binary" ? c : c.toUpperCase());
  for (const ch of text) {
    if (/\s/.test(ch) || fits(ch)) continue;
    const plain = ch.normalize("NFKD").replace(/\p{M}/gu, "");
    return { ch, instead: plain && plain !== ch && [...plain].every(fits) ? plain : null };
  }
  return null;
}

/** Your Name: the name, its code, and whether the plain letters print. */
export default function CodeEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "code" ? arrival.p : null;
  const [name, setName] = useState(a?.x ?? "");
  const [kind, setKind] = useState<CodeKind>(a?.k ?? "card");
  const [secret, setSecret] = useState(a?.h === 1);
  const lex = useLexicon(!!name.trim());
  const x = codeText(name, kind);
  const problem = x ? (typedProblem(name, kind) ?? codeProblem(x, kind)) : null;
  const refused = x && lex ? lex.wordsProblem(x) : null;
  const error = !x
    ? touched
      ? "Add a name."
      : null
    : problem
      ? problem.ch === ""
        ? `Up to ${CODE_MAX} characters.`
        : `${CODE_NAMES[kind]} has no "${problem.ch}".${problem.instead ? ` Try "${problem.instead}".` : ""}`
      : refused;
  const make = (x: string): CustomSpec => ({ t: "code", v: 1, p: { x, k: kind, ...(secret ? { h: 1 as const } : {}) } });
  const spec: CustomSpec | null = x && !problem && lex && !refused ? make(x) : null;

  // No name yet: the example's, in the code and the way chosen.
  useReportSpec(spec, onChange, !x && made.example.t === "code" && make(made.example.p.x));

  return (
    <>
      <Field label="Your name" error={error} htmlFor="make-name">
        <input id="make-name" value={name} maxLength={CODE_MAX + 4} placeholder={made.wordsHint} autoComplete="off" autoCapitalize="characters" onChange={(e) => setName(e.target.value)} aria-invalid={!!error} className={INPUT} />
      </Field>
      <Segmented label="Code" options={KINDS} value={kind} onChange={setKind} format={(k) => CODE_NAMES[k]} />
      <Switch label="Hide the letters" checked={secret} onChange={setSecret} />
    </>
  );
}
