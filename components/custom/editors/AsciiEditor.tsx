"use client";

import { useEffect, useRef, useState } from "react";
import { ASCII_CHARS, ASCII_FILLS, ASCII_MAX, ASCII_PHRASE, type AsciiFill, type CustomSpec } from "@/lib/custom/spec";
import { Field, WordsField, useLexicon, useWords } from "./Field";
import { Segmented, Switch } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

/** The big letters as lines: one line up to ASCII_MAX, else split at the space nearest the middle into two that fit, else null. */
export function asciiLines(text: string): string[] | null {
  const t = text.trim().toUpperCase().replace(/\s+/g, " ");
  if (!t) return null;
  if (t.length <= ASCII_MAX) return [t];
  const spaces = [...t].flatMap((c, i) => (c === " " ? [i] : [])).sort((a, b) => Math.abs(a - t.length / 2) - Math.abs(b - t.length / 2));
  for (const i of spaces) {
    const [a, b] = [t.slice(0, i), t.slice(i + 1)];
    if (a.length <= ASCII_MAX && b.length <= ASCII_MAX) return [a, b];
  }
  return null;
}

const FILL_LABEL: Record<AsciiFill, string> = { self: "Its letters", "#": "#", "@": "@", "%": "%", "8": "8", $: "$", phrase: "A phrase" };

/** Your ASCII: the big letters (one or two lines), what they're typed in, a drop shadow, your words. */
export default function AsciiEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "ascii" ? arrival.p : null;
  const ex = made.example.t === "ascii" ? made.example.p : null;
  const [big, setBig] = useState((a ?? ex)?.x.join(" ") ?? "");
  const [fill, setFill] = useState<AsciiFill>(a?.f ?? "self");
  const [phrase, setPhrase] = useState(a?.p ?? "");
  const [shadow, setShadow] = useState((a ?? ex)?.s === 1);
  const words = useWords(a?.w ?? "");
  const lex = useLexicon(!!big.trim() || !!phrase.trim());

  const bad = [...big].find((ch) => !/\s/.test(ch) && !ASCII_CHARS.test(ch.toUpperCase()));
  const plain = bad?.normalize("NFKD").replace(/\p{M}/gu, "");
  const lines = bad ? null : asciiLines(big);
  const bigError = !big.trim()
    ? touched
      ? "Type a word or two"
      : null
    : bad
      ? `The pixel font has no "${bad}".${plain && plain !== bad && ASCII_CHARS.test(plain.toUpperCase()) ? ` Try "${plain.toUpperCase()}".` : ""}`
      : !lines
        ? `Up to ${ASCII_MAX} letters a line, two lines (a space breaks it)`
        : !lines.some((l) => /[A-Z0-9]/.test(l))
          ? "A letter or a figure, at least"
          : lex
            ? lex.wordsProblem(big)
            : null;
  const p = phrase.trim();
  const phraseError = fill === "phrase" && p ? (!ASCII_PHRASE.test(p) ? "Plain letters, figures and punctuation, up to 24" : lex ? lex.wordsProblem(p) : null) : fill === "phrase" && touched ? "Type the phrase the letters are typed in" : null;
  const w = words.value;
  const ok = lines && !bigError && lex && w !== null && (fill !== "phrase" || (p && !phraseError));
  const spec: CustomSpec | null = ok ? { t: "ascii", v: 1, p: { x: lines!, f: fill, ...(fill === "phrase" ? { p } : {}), ...(shadow ? { s: 1 as const } : {}), ...(w ? { w } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <>
      <Field label="Big letters" hint={`up to ${ASCII_MAX} a line`} error={bigError} htmlFor="make-big">
        <input id="make-big" value={big} maxLength={2 * ASCII_MAX + 1} placeholder="NOA" autoComplete="off" autoCapitalize="characters" onChange={(e) => setBig(e.target.value)} aria-invalid={!!bigError} className={`${INPUT} font-mono uppercase`} />
      </Field>
      <Segmented label="Typed in" options={ASCII_FILLS} value={fill} onChange={setFill} format={(f) => FILL_LABEL[f]} />
      {fill === "phrase" && (
        <Field label="The phrase" error={phraseError} htmlFor="make-phrase">
          <input id="make-phrase" value={phrase} maxLength={24} placeholder="love from tel aviv" autoComplete="off" onChange={(e) => setPhrase(e.target.value)} aria-invalid={!!phraseError} className={`${INPUT} font-mono`} />
        </Field>
      )}
      <Switch label="Drop shadow" checked={shadow} onChange={setShadow} />
      <WordsField words={words} hint={made.wordsHint ?? ""} />
    </>
  );
}
