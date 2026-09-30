"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/custom/specKit";
import { CREDITS_MAX, CREDITS_MIN, CREDIT_NAME_MAX, FAMILY_MAX, PRODUCT, ROLE_MAX, type Credit } from "@/lib/custom/specs/credits";
import { Field, useLexicon } from "./Field";
import { RowsField, yearOf, type Row } from "./RowsField";
import { TextField, checkText, noProblem, useText } from "./TextField";
import { orExample, useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Your Credits: the family, who did what (two to twelve), the year. */
export default function CreditsEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "credits" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const family = useText(a?.f ?? "", FAMILY_MAX, lex, { required: "Add the family’s name.", touched });
  const [rows, setRows] = useState<Row[]>(a ? a.x.map(([r, n]) => ({ r, n })) : Array.from({ length: CREDITS_MIN }, () => ({ r: "", n: "" })));
  const [year, setYear] = useState(a?.y ? String(a.y) : "");
  const cells = rows.map((r) => ({ r: checkText(r.r, ROLE_MAX, lex), n: checkText(r.n, CREDIT_NAME_MAX, lex) }));
  const full = cells.filter((c) => c.r.value && c.n.value);
  const half = cells.some((c) => !!c.r.value !== !!c.n.value);
  const few = full.length < CREDITS_MIN;
  const errors = cells.map((c, i) => ({
    r: c.r.error ?? (touched && !c.r.value && (c.n.value || (few && i < CREDITS_MIN)) ? "Add the role." : null),
    n: c.n.error ?? (touched && !c.n.value && (c.r.value || (few && i < CREDITS_MIN)) ? "Add who." : null),
  }));
  const y = yearOf(year, FIRST_YEAR, LAST_YEAR);
  const ok = !!lex && !!family.value && !few && !half && cells.every((c) => c.r.value !== null && c.n.value !== null) && y !== null;
  const x: Credit[] = full.map((c) => [c.r.value!, c.n.value!]);
  const spec: CustomSpec | null = ok ? { t: "credits", v: 1, p: { f: family.value!, x, ...(y ? { y } : {}) } } : null;

  // Anything not yet typed: the example's, cell by cell (as the placeholders say).
  const cellsOk = cells.every((c) => c.r.value !== null && c.n.value !== null);
  const px = cells.flatMap((c, i): Credit[] => {
    const [r, n] = [orExample(c.r.value, ex.x[i]?.[0]), orExample(c.n.value, ex.x[i]?.[1])];
    return r && n ? [[r, n]] : [];
  });
  useReportSpec(spec, onChange, noProblem(family) && cellsOk && y !== null && px.length >= CREDITS_MIN && { t: "credits", v: 1, p: { f: orExample(family.value, ex.f)!, x: px, ...(y ? { y } : {}) } });

  return (
    <>
      <TextField id="make-credits-family" label="The family" hint="A … FAMILY PRODUCTION" state={family} max={FAMILY_MAX} placeholder={ex.f} />
      <RowsField
        id="make-credits"
        noun="credit"
        columns={[
          { key: "r", label: "Role", max: ROLE_MAX },
          { key: "n", label: "Name", max: CREDIT_NAME_MAX },
        ]}
        rows={rows}
        setRows={setRows}
        min={CREDITS_MIN}
        max={CREDITS_MAX}
        errors={errors}
        placeholders={ex.x.map(([r, n]) => ({ r, n }))}
      />
      <Field label="Year" hint="optional" error={y === null ? `Between ${FIRST_YEAR} and ${LAST_YEAR}.` : null} htmlFor="make-credits-year">
        <input id="make-credits-year" value={year} inputMode="numeric" maxLength={4} placeholder={String(ex.y)} onChange={(e) => setYear(e.target.value)} className={INPUT} />
      </Field>
    </>
  );
}
