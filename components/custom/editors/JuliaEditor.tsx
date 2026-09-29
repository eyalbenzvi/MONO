"use client";

import { useState } from "react";
import { FIRST_YEAR, LAST_YEAR, parseDate, type CustomSpec } from "@/lib/custom/spec";
import { PRODUCT } from "@/lib/custom/specs/julia";
import { Field } from "./Field";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Your Fractal: the date (it picks the set) and the caption (CaptionField). */
export default function JuliaEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "julia" ? arrival.p : null;
  const [date, setDate] = useState(a?.d ?? PRODUCT.example.d);
  const [left, setLeft] = useState(false);

  const dateOk = !!parseDate(date);
  const spec: CustomSpec | null = dateOk ? { t: "julia", v: 1, p: { d: date } } : null;
  useReportSpec(spec, onChange);

  return (
    <>
      <Field label="Date" error={(left || touched) && !dateOk ? `A date from ${FIRST_YEAR} to ${LAST_YEAR}.` : null} htmlFor="make-julia-date">
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
    </>
  );
}
