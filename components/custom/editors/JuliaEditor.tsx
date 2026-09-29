"use client";

import { useEffect, useRef, useState } from "react";
import { FIRST_YEAR, LAST_YEAR, parseDate, type CustomSpec } from "@/lib/custom/spec";
import { PRODUCT } from "@/lib/custom/specs/julia";
import { Field, WordsField, useWords } from "./Field";
import { INPUT, type EditorProps } from "./types";

/** Your Fractal: the date (it picks the set) and your words. */
export default function JuliaEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "julia" ? arrival.p : null;
  const [date, setDate] = useState(a?.d ?? PRODUCT.example.d);
  const [left, setLeft] = useState(false);
  const words = useWords(a?.w ?? "");

  const dateOk = !!parseDate(date);
  const w = words.value;
  const spec: CustomSpec | null = dateOk && w !== null ? { t: "julia", v: 1, p: { d: date, ...(w ? { w } : {}) } } : null;
  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <>
      <Field label="Date" error={(left || touched) && !dateOk ? `Pick a date between ${FIRST_YEAR} and ${LAST_YEAR}` : null} htmlFor="make-julia-date">
        <input
          id="make-julia-date"
          type="date"
          min={`${FIRST_YEAR}-01-01`}
          max={`${LAST_YEAR}-12-31`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={() => setLeft(true)}
          aria-invalid={!dateOk}
          className={INPUT}
        />
      </Field>
      <WordsField words={words} hint={made.wordsHint ?? ""} touched={touched} />
    </>
  );
}
