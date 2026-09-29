"use client";

import { useState } from "react";
import { FIRST_YEAR, LAST_YEAR, cleanWords, parseDate, type CustomSpec } from "@/lib/custom/spec";
import { ORBIT_MAX, ORBIT_MIN, ORBIT_NAME, PRODUCT, dateOf, dayOf, eldest, packDays, unpackDays } from "@/lib/custom/specs/orbits";
import { Field, nameLine, useLexicon } from "./Field";
import { Segmented } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const LINK = "h-10 text-sm text-neutral-300 underline underline-offset-4 hover:text-white disabled:opacity-30";
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (n: number) => {
  const [y, m, d] = dateOf(n);
  return `${y}-${pad(m)}-${pad(d)}`;
};

interface Row {
  name: string;
  date: string;
}

/**
 * Your Family Orbits: two to nine people, each a name and a birth date (the
 * date places them: the eldest is the sun, the elder nearer, the birthday
 * the angle), who's at the centre, and a title.
 */
export default function OrbitsEditor({ arrival, touched, onChange }: EditorProps) {
  const ex = PRODUCT.example;
  const a = arrival?.t === "orbits" ? arrival.p : null;
  // A link's print fills the rows; else as many empty rows as the example has, its names as placeholders.
  const [rows, setRows] = useState<Row[]>(() => {
    if (!a) return ex.n.map(() => ({ name: "", date: "" }));
    const days = unpackDays(a.b) ?? [];
    return a.n.map((name, i) => ({ name, date: days[i] !== undefined ? iso(days[i]) : "" }));
  });
  const [centre, setCentre] = useState<number>(a?.s ?? -1);
  const [left, setLeft] = useState<Record<number, boolean>>({});
  const lex = useLexicon(rows.some((r) => r.name.trim()));

  const names = rows.map((r) => cleanWords(r.name, ORBIT_NAME));
  const dates = rows.map((r) => (parseDate(r.date) ? r.date : null));
  const nameError = (i: number) => {
    const r = rows[i];
    if (!r.name.trim()) return touched || left[i] ? "Type a name" : null;
    if (!names[i]) return nameLine(r.name, ORBIT_NAME);
    return lex ? lex.wordsProblem(names[i]!) : null;
  };
  const dateError = (i: number) => (!dates[i] && (touched || left[i]) ? `A date from ${FIRST_YEAR} to ${LAST_YEAR}.` : null);
  const ok = !!lex && rows.every((_, i) => names[i] && !nameError(i) && dates[i]);
  const days = ok ? (dates as string[]).map(dayOf) : [];
  const sun = centre >= 0 && centre < rows.length ? centre : -1;
  const spec: CustomSpec | null =
    ok
      ? { t: "orbits", v: 1, p: { n: names as string[], b: packDays(dates as string[]), ...(sun >= 0 && sun !== eldest(days) ? { s: sun } : {}) } }
      : null;

  useReportSpec(spec, onChange);

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => {
    setRows((rs) => rs.filter((_, j) => j !== i));
    setCentre((c) => (c === i ? -1 : c > i ? c - 1 : c));
  };

  return (
    <>
      <div>
        <p className="mb-1 text-xs font-medium text-neutral-400">
          The family <span className="text-neutral-500">{`${ORBIT_MIN} to ${ORBIT_MAX}, with birthdays`}</span>
        </p>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_9.5rem] items-start gap-2">
              <Field label={`Name ${i + 1}`} error={nameError(i)} htmlFor={`make-orbits-name-${i}`}>
                <input id={`make-orbits-name-${i}`} value={r.name} maxLength={ORBIT_NAME + 4} placeholder={ex.n[i] ?? "Noa"} autoComplete="off" onChange={(e) => set(i, { name: e.target.value })} onBlur={() => setLeft((x) => ({ ...x, [i]: true }))} aria-invalid={!!nameError(i)} className={INPUT} />
              </Field>
              <Field label="Born" error={dateError(i)} htmlFor={`make-orbits-date-${i}`}>
                <input id={`make-orbits-date-${i}`} type="date" min={`${FIRST_YEAR}-01-01`} max={`${LAST_YEAR}-12-31`} value={r.date} onChange={(e) => set(i, { date: e.target.value })} onBlur={() => setLeft((x) => ({ ...x, [i]: true }))} aria-invalid={!!dateError(i)} className={INPUT} />
              </Field>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-4">
          <button type="button" className={LINK} disabled={rows.length >= ORBIT_MAX} onClick={() => setRows((rs) => [...rs, { name: "", date: "" }])}>
            Add someone
          </button>
          <button type="button" className={LINK} disabled={rows.length <= ORBIT_MIN} onClick={() => remove(rows.length - 1)} aria-label={`Remove ${rows[rows.length - 1]?.name.trim() || "the last one"}`}>
            Remove the last
          </button>
        </div>
      </div>
      <Segmented label="At the centre" options={[-1, ...rows.map((_, i) => i)]} value={sun} onChange={setCentre} format={(i) => (i < 0 ? "The eldest" : names[i] || `Name ${i + 1}`)} />
    </>
  );
}
