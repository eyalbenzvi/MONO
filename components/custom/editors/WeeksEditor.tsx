"use client";

import { useState } from "react";
import { FIRST_YEAR, LAST_YEAR, cleanWords, parseDate, type CustomSpec } from "@/lib/custom/spec";
import { MILESTONES_MAX, MILESTONE_LABEL_MAX, PRODUCT, WEEKS_YEARS, weeksDateProblem, type Milestone, type Params } from "@/lib/custom/specs/weeks";
import { Field, nameLine, useLexicon, useWords, WordsField } from "./Field";
import { Segmented } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
/** Today on this device: only the field's starting value (the print draws the day in the spec, never the clock). */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Your Life in Weeks: the birthday, the day it's counted to, 80 or 90 years, up to five milestones, the words. */
export default function WeeksEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "weeks" ? (arrival.p as Params) : null;
  const ex = PRODUCT.example;
  const [b, setB] = useState(a?.b ?? "");
  const [asOf, setAsOf] = useState(a ? a.a : today);
  const [n, setN] = useState<Params["n"]>((a ?? ex).n);
  // A link's milestones, else as many empty rows as the example has, its labels as placeholders.
  const [marks, setMarks] = useState<{ d: string; l: string }[]>(() => (a ? (a.m ?? []).map(([d, l]) => ({ d, l })) : (ex.m ?? []).map(() => ({ d: "", l: "" }))));
  const words = useWords(a?.w ?? "");
  const lex = useLexicon(marks.some((m) => m.l.trim()));

  const bOk = !!parseDate(b);
  const bError = bOk ? null : touched || b ? `A date from ${FIRST_YEAR} to ${LAST_YEAR}.` : null;
  const asError = bOk ? weeksDateProblem(b, n, asOf) : null;
  // A row left empty is no milestone; a half-filled one says what it needs.
  const rows = marks.map((m) => {
    const d = m.d, l = m.l.replace(/\s+/g, " ").trim();
    if (!d && !l) return { skip: true, error: null, d, l };
    const dErr = !bOk ? null : d ? weeksDateProblem(b, n, d) : "Pick its date";
    const lErr = !l ? "Name it" : cleanWords(l, MILESTONE_LABEL_MAX) !== l ? nameLine(l, MILESTONE_LABEL_MAX) : lex ? lex.wordsProblem(l) : null;
    return { skip: false, error: dErr ?? lErr, d, l };
  });
  const kept = rows.filter((r) => !r.skip);
  const dates = kept.map((r) => r.d).sort();
  const twice = dates.some((d, i) => i > 0 && d === dates[i - 1]);
  const m: Milestone[] = kept.map((r) => [r.d, r.l] as Milestone).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const w = words.value;
  const ok = bOk && !asError && !twice && rows.every((r) => !r.error) && (!kept.length || lex) && w !== null;
  const spec: CustomSpec | null = ok ? { t: "weeks", v: 1, p: { b, a: asOf, n, ...(m.length ? { m } : {}), ...(w ? { w } : {}) } } : null;

  useReportSpec(spec, onChange);

  const setMark = (i: number, v: Partial<{ d: string; l: string }>) => setMarks((xs) => xs.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const dateInput = (id: string, value: string, set: (v: string) => void, invalid: boolean) => (
    <input id={id} type="date" min={`${FIRST_YEAR}-01-01`} max={`${LAST_YEAR}-12-31`} value={value} onChange={(e) => set(e.target.value)} aria-invalid={invalid} className={INPUT} />
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Birthday" error={bError} htmlFor="make-weeks-born">
          {dateInput("make-weeks-born", b, setB, !!bError)}
        </Field>
        <Field label="Until" error={asError} htmlFor="make-weeks-to">
          {dateInput("make-weeks-to", asOf, setAsOf, !!asError)}
        </Field>
      </div>
      <Segmented label="Years" options={WEEKS_YEARS} value={n} onChange={setN} />
      {marks.map((mk, i) => (
        <div key={i} className="grid grid-cols-[9.5rem_1fr_auto] items-end gap-3">
          <Field label={`Milestone ${i + 1}`} error={rows[i].error} htmlFor={`make-weeks-m${i}`}>
            {dateInput(`make-weeks-m${i}`, mk.d, (d) => setMark(i, { d }), !!rows[i].error)}
          </Field>
          <Field label="Label" htmlFor={`make-weeks-l${i}`}>
            <input id={`make-weeks-l${i}`} value={mk.l} maxLength={MILESTONE_LABEL_MAX + 4} placeholder={ex.m?.[i]?.[1] ?? "Married"} autoComplete="off" onChange={(e) => setMark(i, { l: e.target.value })} aria-invalid={!!rows[i].error} className={INPUT} />
          </Field>
          <button type="button" onClick={() => setMarks((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove milestone ${i + 1}`} className="h-11 text-neutral-300 underline underline-offset-4 hover:text-white">
            Remove
          </button>
        </div>
      ))}
      {twice && <p className="text-xs text-neutral-300">One milestone a day.</p>}
      {marks.length < MILESTONES_MAX && (
        <button type="button" onClick={() => setMarks((xs) => [...xs, { d: "", l: "" }])} className="h-10 w-fit text-neutral-300 underline underline-offset-4 hover:text-white">
          Add a milestone
        </button>
      )}
      <WordsField words={words} hint={made.wordsHint ?? PRODUCT.wordsHint ?? ""} touched={touched} />
    </>
  );
}
