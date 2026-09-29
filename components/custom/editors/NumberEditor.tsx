"use client";

import { useEffect, useRef, useState } from "react";
import { UNITS, WORDS_MAX, cleanWords, parseClock, type CustomSpec, type Face } from "@/lib/custom/spec";
import { Field, useLexicon } from "./Field";
import { Segmented } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

const OTHER = "other";
const UNIT_FREE = /^[\p{Script=Latin}0-9²³°%/. ]{1,6}$/u;

/** What was typed as the spec's value: a time "h:mm:ss" (string), a number (at most three decimals), or null. */
function parseValue(raw: string): number | string | null {
  const t = raw.trim();
  if (parseClock(t) !== null) return t;
  if (!/^-?\d{1,5}([.,]\d{1,3})?$/.test(t)) return null;
  const n = Number(t.replace(",", "."));
  return Math.abs(n) <= 99999 ? n : null;
}

/** Your Number: the number (or a time), its unit, a label; the face only when a time can take either. */
export default function NumberEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "number" ? arrival.p : null;
  const [raw, setRaw] = useState(a ? String(a.v) : "3.4");
  const known = !a || (UNITS as readonly string[]).includes(a.u);
  const [unit, setUnit] = useState<string>(a ? (known ? a.u : OTHER) : "kg");
  const [free, setFree] = useState(a && !known ? a.u : "");
  const [label, setLabel] = useState(a?.l ?? (a ? "" : "Birth weight"));
  const [face, setFace] = useState<Face>(a?.face ?? "stopwatch");
  const lex = useLexicon(true);

  const v = parseValue(raw);
  const isTime = typeof v === "string";
  const u = isTime ? "" : unit === OTHER ? free.trim() : unit;
  const unitError = unit === OTHER && !isTime && u && !UNIT_FREE.test(u) ? "Up to 6 letters, numbers or signs" : unit === OTHER && lex && u ? lex.wordsProblem(u) : null;
  const l = label.trim() ? cleanWords(label) : undefined;
  const labelError = label.trim() ? (l === null ? `Up to ${WORDS_MAX} letters and numbers.` : lex ? lex.wordsProblem(label) : null) : null;
  const valueError = v === null && (touched || raw.trim()) ? "A number (up to 99999, three decimals) or a time like 3:41:07" : null;
  const f: Face = isTime ? face : "dial";
  const spec: CustomSpec | null = v !== null && lex && !unitError && !labelError && l !== null ? { t: "number", v: 1, p: { v, u, ...(l ? { l } : {}), face: f } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Your number" hint="or a time" error={valueError} htmlFor="make-number">
          <input id="make-number" value={raw} inputMode="decimal" autoComplete="off" placeholder="3.4 or 3:41:07" onChange={(e) => setRaw(e.target.value)} aria-invalid={!!valueError} className={`${INPUT} font-mono`} />
        </Field>
        {!isTime && (
          <Field label="Unit" htmlFor="make-unit">
            <select id="make-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={INPUT}>
              {UNITS.map((x) => (
                <option key={x} value={x} className="bg-ink-900">
                  {x || "None"}
                </option>
              ))}
              <option value={OTHER} className="bg-ink-900">
                Other…
              </option>
            </select>
          </Field>
        )}
      </div>
      {!isTime && unit === OTHER && (
        <Field label="Your unit" error={unitError} htmlFor="make-unit-free">
          <input id="make-unit-free" value={free} maxLength={6} autoComplete="off" placeholder="laps" onChange={(e) => setFree(e.target.value)} className={INPUT} />
        </Field>
      )}
      <Field label="Label" hint="optional" error={labelError} htmlFor="make-label">
        <input id="make-label" value={label} maxLength={WORDS_MAX} autoComplete="off" placeholder="First marathon" onChange={(e) => setLabel(e.target.value)} className={INPUT} />
      </Field>
      {isTime && <Segmented label="Face" options={["stopwatch", "dial"] as const} value={face} onChange={setFace} format={(x) => (x === "dial" ? "Dial" : "Stopwatch")} />}
    </>
  );
}
