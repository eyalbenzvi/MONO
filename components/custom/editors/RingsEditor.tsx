"use client";

import { useState } from "react";
import { FIRST_YEAR, LAST_YEAR, type CustomSpec } from "@/lib/custom/spec";
import { MARK_DIGIT, PRODUCT, SCARS_MAX, spanProblem, type Params } from "@/lib/custom/specs/rings";
import { Field } from "./Field";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Years as typed ("1995, 2004–2006"): the list, or a one-line reason. Ranges with a hyphen or a dash. */
function parseYears(text: string, b: number, c: number): number[] | string {
  const out = new Set<number>();
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d{4})(?:[-–](\d{4}))?$/.exec(part);
    if (!m) return `Years like 1995, or 2004–2006`;
    const [y0, y1] = [Number(m[1]), Number(m[2] ?? m[1])];
    if (y1 < y0) return `${part}: the earlier year first`;
    if (y0 < b || y1 > c) return `Years from ${b} to ${c}`;
    for (let y = y0; y <= y1; y++) out.add(y);
  }
  return [...out].sort((x, y) => x - y);
}
/** A list of years as the field shows it: runs of three or more as ranges. */
function yearsText(ys: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < ys.length; ) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    if (j - i >= 2) parts.push(`${ys[i]}–${ys[j]}`);
    else for (let q = i; q <= j; q++) parts.push(String(ys[q]));
    i = j + 1;
  }
  return parts.join(", ");
}
const marked = (p: Params, d: string) => [...p.m].flatMap((x, i) => (x === d ? [p.b + i] : []));

/** Your Tree Rings: the first and last year, the good years, the hard years, the scars. */
export default function RingsEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "rings" ? (arrival.p as Params) : null;
  const ex = PRODUCT.example;
  const [from, setFrom] = useState(a ? String(a.b) : "");
  const [to, setTo] = useState(a ? String(a.c) : "");
  const [good, setGood] = useState(a ? yearsText(marked(a, MARK_DIGIT.good)) : "");
  const [hard, setHard] = useState(a ? yearsText(marked(a, MARK_DIGIT.hard)) : "");
  const [scars, setScars] = useState((a?.s ?? []).join(", "));

  const [b, c] = [Number(from), Number(to)];
  const yearOk = (s: string) => /^\d{4}$/.test(s);
  const yearError = `A year from ${FIRST_YEAR} to ${LAST_YEAR}.`;
  const fromError = !yearOk(from) ? (touched || from ? yearError : null) : spanProblem(b, b);
  const toError = fromError ? null : !yearOk(to) ? (touched || to ? yearError : null) : spanProblem(b, c);
  const spanOk = yearOk(from) && yearOk(to) && !fromError && !toError;
  const g = spanOk ? parseYears(good, b, c) : [];
  const h = spanOk ? parseYears(hard, b, c) : [];
  const sc = spanOk ? parseYears(scars, b, c) : [];
  const both = Array.isArray(g) && Array.isArray(h) ? g.find((y) => h.includes(y)) : undefined;
  const goodError = typeof g === "string" ? g : null;
  const hardError = typeof h === "string" ? h : both !== undefined ? `${both} can’t be good and hard` : null;
  const scarError = typeof sc === "string" ? sc : sc.length > SCARS_MAX ? `Up to ${SCARS_MAX} scars` : null;
  let spec: CustomSpec | null = null;
  if (spanOk && !goodError && !hardError && !scarError) {
    const m = Array.from({ length: c - b + 1 }, (_, i) => ((g as number[]).includes(b + i) ? MARK_DIGIT.good : (h as number[]).includes(b + i) ? MARK_DIGIT.hard : MARK_DIGIT.normal)).join("");
    const s = sc as number[];
    spec = { t: "rings", v: 1, p: { b, c, m, ...(s.length ? { s } : {}) } };
  }

  useReportSpec(spec, onChange);

  const year = (id: string, value: string, set: (v: string) => void, invalid: boolean, placeholder: string) => (
    <input id={id} inputMode="numeric" maxLength={4} autoComplete="off" placeholder={placeholder} value={value} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))} aria-invalid={invalid} className={`${INPUT} font-mono`} />
  );
  const list = (id: string, value: string, set: (v: string) => void, invalid: boolean, placeholder: string) => (
    <input id={id} value={value} autoComplete="off" placeholder={placeholder} onChange={(e) => set(e.target.value)} aria-invalid={invalid} className={`${INPUT} font-mono`} />
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First year" error={fromError} htmlFor="make-rings-from">
          {year("make-rings-from", from, setFrom, !!fromError, String(ex.b))}
        </Field>
        <Field label="Last year" error={toError} htmlFor="make-rings-to">
          {year("make-rings-to", to, setTo, !!toError, String(ex.c))}
        </Field>
      </div>
      <Field label="Good years" hint="wide rings" error={goodError} htmlFor="make-rings-good">
        {list("make-rings-good", good, setGood, !!goodError, "1995, 2004–2006")}
      </Field>
      <Field label="Hard years" hint="narrow rings" error={hardError} htmlFor="make-rings-hard">
        {list("make-rings-hard", hard, setHard, !!hardError, "2001, 2020")}
      </Field>
      <Field label="Scars" hint={`up to ${SCARS_MAX}: a fire, a break`} error={scarError} htmlFor="make-rings-scars">
        {list("make-rings-scars", scars, setScars, !!scarError, "2009")}
      </Field>
    </>
  );
}
