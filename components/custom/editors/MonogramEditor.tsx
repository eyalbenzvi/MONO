"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { MONO_STYLES, PRODUCT, initialsProblem, type MonoStyle } from "@/lib/custom/specs/monogram";
import { Field, useLexicon } from "./Field";
import { Segmented } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

const STYLE_LABEL: Record<MonoStyle, string> = { lace: "Interlaced", stack: "Stacked", seal: "Seal" };

/** Your Monogram: the initials (two or three), how they're arranged, and a year (optional). */
export default function MonogramEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "monogram" ? arrival.p : PRODUCT.example;
  const [initials, setInitials] = useState(a.x);
  const [style, setStyle] = useState<MonoStyle>(a.s);
  const [year, setYear] = useState(a.y !== undefined ? String(a.y) : "");
  const lex = useLexicon(!!initials.trim());

  const x = initials.replace(/[\s.]/g, "").toUpperCase();
  const problem = x ? initialsProblem(initials) : null;
  const refused = x && !problem && lex ? lex.wordsProblem(x) : null;
  const error = !x ? (touched ? "Type two or three initials" : null) : (problem ?? refused);
  const y = year.trim() === "" ? undefined : /^\d{4}$/.test(year.trim()) && +year >= 1900 && +year <= 2100 ? +year : null;
  const spec: CustomSpec | null = x && !problem && lex && !refused && y !== null ? { t: "monogram", v: 1, p: { x, s: style, ...(y !== undefined ? { y } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <>
      <Field label="Initials" hint="two or three" error={error} htmlFor="make-monogram-initials">
        <input id="make-monogram-initials" value={initials} maxLength={6} placeholder="NDL" autoComplete="off" autoCapitalize="characters" onChange={(e) => setInitials(e.target.value)} aria-invalid={!!error} className={`${INPUT} font-mono uppercase`} />
      </Field>
      <Segmented label="Arrangement" options={MONO_STYLES} value={style} onChange={setStyle} format={(s) => STYLE_LABEL[s]} />
      <Field label="Year" hint="optional" error={y === null ? "A year from 1900 to 2100" : null} htmlFor="make-monogram-year">
        <input id="make-monogram-year" value={year} inputMode="numeric" maxLength={4} placeholder="2024" autoComplete="off" onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} aria-invalid={y === null} className={`${INPUT} font-mono`} />
      </Field>
    </>
  );
}
