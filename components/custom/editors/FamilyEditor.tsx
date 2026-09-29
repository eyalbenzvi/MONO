"use client";

import { useState } from "react";
import { cleanWords, type CustomSpec } from "@/lib/custom/spec";
import { packInts } from "@/lib/custom/specKit";
import { FAMILY_NAME_MAX, PRODUCT, familyYears, packYears, parseYears, yearsProblem, yearsText, type Params, type Years } from "@/lib/custom/specs/family";
import { Field, nameLine, useLexicon, useWords, WordsField } from "./Field";
import { Switch } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Who each slot is, in pedigree order (0 you, a person's parents at 2i + 1 and 2i + 2). */
const RELATION = ["You", "Father", "Mother", "Father’s father", "Father’s mother", "Mother’s father", "Mother’s mother"];
const LEGEND = "mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500";

/** Your Family Tree: your name, your parents, grandparents and (a switch) great-grandparents, each with optional years; the words. */
export default function FamilyEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "family" ? (arrival.p as Params) : null;
  const ex = PRODUCT.example;
  const pad = <T,>(xs: T[], fill: T) => [...xs, ...Array<T>(15 - xs.length).fill(fill)];
  const [names, setNames] = useState<string[]>(() => pad(a?.n ?? [], ""));
  const [years, setYears] = useState<string[]>(() => pad(a ? familyYears(a).map(yearsText).map((t) => t.replace(/^b\. /, "").replace(/^d\. /, "–")) : [], ""));
  const [four, setFour] = useState(a?.n.length === 15);
  const words = useWords(a ? (a.w ?? "") : "");
  const count = four ? 15 : 7;
  const lex = useLexicon(names.slice(0, count).some((n) => n.trim()));

  const rows = names.slice(0, count).map((raw, i) => {
    const nm = raw.replace(/\s+/g, " ").trim();
    const ys = parseYears(years[i]);
    const nameError = !nm
      ? i === 0 && (touched || raw)
        ? "Type your name"
        : null
      : cleanWords(nm, FAMILY_NAME_MAX) !== nm
        ? nameLine(nm, FAMILY_NAME_MAX)
        : lex
          ? lex.wordsProblem(nm)
          : null;
    const yearsError = !ys ? "Years like 1932–2010" : yearsProblem(ys) ?? (!nm && (ys[0] !== null || ys[1] !== null) ? "Name them first" : null);
    return { nm, ys: (ys ?? [null, null]) as Years, nameError, yearsError };
  });
  const w = words.value;
  const ok = !!rows[0].nm && lex && rows.every((r) => !r.nameError && !r.yearsError) && w !== null;
  const ys = rows.map((r) => r.ys);
  const anyYears = ys.some(([b, d]) => b !== null || d !== null);
  const spec: CustomSpec | null = ok ? { t: "family", v: 1, p: { n: rows.map((r) => r.nm), ...(anyYears ? { y: packInts(packYears(ys)) } : {}), ...(w ? { w } : {}) } } : null;

  useReportSpec(spec, onChange);

  const set = (i: number, v: string, which: "n" | "y") => (which === "n" ? setNames : setYears)((xs) => xs.map((x, j) => (j === i ? v : x)));
  /** One person: the name (the example's as its placeholder), and the years beside it (no label of their own: the placeholder says what they are). */
  const person = (i: number, labelText: string) => (
    <div key={i} className="grid grid-cols-[1fr_6.5rem] items-start gap-2">
      <Field label={labelText} error={rows[i].nameError} htmlFor={`make-family-n${i}`}>
        <input id={`make-family-n${i}`} value={names[i]} maxLength={FAMILY_NAME_MAX + 4} placeholder={ex.n[i] || undefined} autoComplete="off" onChange={(e) => set(i, e.target.value, "n")} aria-invalid={!!rows[i].nameError} className={INPUT} />
      </Field>
      <div className="pt-5">
        <input id={`make-family-y${i}`} value={years[i]} maxLength={11} placeholder="1932–2010" inputMode="numeric" autoComplete="off" onChange={(e) => set(i, e.target.value, "y")} aria-label={`${labelText}: years`} aria-invalid={!!rows[i].yearsError} className={INPUT} />
        {rows[i].yearsError && <p className="mt-1 text-xs text-neutral-300">{rows[i].yearsError}</p>}
      </div>
    </div>
  );
  /** A great-grandparent's label: whose parent, by the name typed or who they are ("David Levin’s father", "Father’s father’s father"). */
  const whose = (c: number, parent: string) => `${rows[c]?.nm || RELATION[c]}’s ${parent}`;

  return (
    <>
      {person(0, "Your name")}
      <fieldset className="grid gap-3">
        <legend className={LEGEND}>Parents</legend>
        {person(1, "Father")}
        {person(2, "Mother")}
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className={LEGEND}>Grandparents</legend>
        {[3, 4, 5, 6].map((i) => person(i, RELATION[i]))}
      </fieldset>
      <p className="text-xs text-neutral-500">Leave anyone out: their place prints hatched.</p>
      <Switch label="Great-grandparents" checked={four} onChange={setFour} />
      {four && (
        <fieldset aria-label="Great-grandparents" className="grid gap-3">
          {[3, 4, 5, 6].map((c) => (
            <div key={c} className="grid gap-3">
              {person(2 * c + 1, whose(c, "father"))}
              {person(2 * c + 2, whose(c, "mother"))}
            </div>
          ))}
        </fieldset>
      )}
      <WordsField words={words} hint={made.wordsHint ?? PRODUCT.wordsHint ?? ""} touched={touched} />
    </>
  );
}
