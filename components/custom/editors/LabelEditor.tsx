"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { TOO_LONG } from "@/lib/custom/kit";
import { FIRST_YEAR, LAST_YEAR, parseDate } from "@/lib/custom/specKit";
import { LABEL_CREDITS, LABEL_LINE_MAX, LABEL_MEDIUMS, LABEL_NAME_MAX, LABEL_PLACE_MAX, PRODUCT, creditFit, mediumFit } from "@/lib/custom/specs/label";
import { Field, useLexicon } from "./Field";
import { yearOf } from "./RowsField";
import { TextField, allOk, noProblem, useText } from "./TextField";
import { orExample, useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** The next of our lines after the one shown (or the first). */
const next = (list: readonly string[], now: string) => list[(list.indexOf(now) + 1) % list.length];

/** Your Museum Label: the name, the year and place, the medium and the credit (ours or yours), the day it was acquired. */
export default function LabelEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "label" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const name = useText(a?.n ?? "", LABEL_NAME_MAX, lex, { required: "Add a name.", touched });
  const [born, setBorn] = useState(a?.b ? String(a.b) : "");
  const place = useText(a?.pl ?? "", LABEL_PLACE_MAX, lex);
  const medium = useText(a?.md ?? LABEL_MEDIUMS[0], LABEL_LINE_MAX, lex, { required: "Add a medium, or pick one of ours.", touched });
  const credit = useText(a ? (a.cr ?? "") : LABEL_CREDITS[0], LABEL_LINE_MAX, lex);
  const [date, setDate] = useState(a?.d ?? "");
  const b = yearOf(born, FIRST_YEAR, LAST_YEAR);
  const mdLong = medium.value && !mediumFit(medium.value) ? TOO_LONG : null;
  const crLong = credit.value && !creditFit(credit.value) ? TOO_LONG : null;
  const dateOk = !date || !!parseDate(date);
  const ok = allOk(lex, name, place, medium, credit) && !!name.value && !!medium.value && b !== null && dateOk && !mdLong && !crLong;
  const make = (n: string | null, md: string | null): CustomSpec => ({ t: "label", v: 1, p: { n: n!, ...(b ? { b } : {}), ...(place.value ? { pl: place.value } : {}), md: md!, ...(credit.value ? { cr: credit.value } : {}), ...(date ? { d: date } : {}) } });
  const spec: CustomSpec | null = ok ? make(name.value!, medium.value!) : null;

  // The name or the medium not yet typed: the example's.
  useReportSpec(spec, onChange, noProblem(name, place, medium, credit) && b !== null && dateOk && !mdLong && !crLong && make(orExample(name.value, ex.n), orExample(medium.value, ex.md)));

  const another = (state: typeof medium, list: readonly string[]) => (
    <button type="button" onClick={() => state.setText(next(list, state.text))} className="text-xs text-neutral-300 underline underline-offset-4 hover:text-white">
      Another of ours
    </button>
  );

  return (
    <>
      <TextField id="make-label-name" label="Name" state={name} max={LABEL_NAME_MAX} placeholder={ex.n} />
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Field label="Born" hint="optional" error={b === null ? `Between ${FIRST_YEAR} and ${LAST_YEAR}.` : null} htmlFor="make-label-born">
          <input id="make-label-born" value={born} inputMode="numeric" maxLength={4} placeholder={String(ex.b)} onChange={(e) => setBorn(e.target.value)} className={INPUT} />
        </Field>
        <TextField id="make-label-place" label="Where" hint="optional" state={place} max={LABEL_PLACE_MAX} placeholder={ex.pl} />
      </div>
      <div>
        <TextField id="make-label-medium" label="Medium" state={{ ...medium, error: medium.error ?? mdLong }} max={LABEL_LINE_MAX} suggestions={LABEL_MEDIUMS} />
        {another(medium, LABEL_MEDIUMS)}
      </div>
      <div>
        <TextField id="make-label-credit" label="Credit line" hint="optional" state={{ ...credit, error: credit.error ?? crLong }} max={LABEL_LINE_MAX} suggestions={LABEL_CREDITS} />
        {another(credit, LABEL_CREDITS)}
      </div>
      <Field label="Acquired" hint="optional: the accession number" error={dateOk ? null : "Between 1900 and 2100."} htmlFor="make-label-date">
        <input id="make-label-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
      </Field>
    </>
  );
}
