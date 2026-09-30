"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/custom/specKit";
import { EDITIONS_MAX, EDITION_NAME_MAX, PRODUCT, ROLE_MAX, type Edition } from "@/lib/custom/specs/editions";
import { Field, useLexicon } from "./Field";
import { RowsField, yearOf, type Row } from "./RowsField";
import { TextField, checkText, noProblem, useText } from "./TextField";
import { orExample, useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const YEARS = `Between ${FIRST_YEAR} and ${LAST_YEAR}.`;

/** Limited Editions: the editions in order (a name, a year), the maker on the seal, the year the series began. */
export default function EditionsEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "editions" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [rows, setRows] = useState<Row[]>(a ? a.x.map(([n, y]) => ({ n, y: y ? String(y) : "" })) : [{ n: "", y: "" }, { n: "", y: "" }]);
  const role = useText(a?.r ?? "", ROLE_MAX, lex, { required: "Add who made them.", touched });
  const [est, setEst] = useState(a?.e ? String(a.e) : "");
  const cells = rows.map((r) => ({ n: checkText(r.n, EDITION_NAME_MAX, lex), y: yearOf(r.y, FIRST_YEAR, LAST_YEAR) }));
  const errors = cells.map((c, i) => ({ n: c.n.error ?? (c.n.value === undefined && ((touched && i === 0) || c.y !== undefined) ? "Add a name." : null), y: c.y === null ? YEARS : null }));
  const e = yearOf(est, FIRST_YEAR, LAST_YEAR);
  const named = cells.filter((c) => c.n.value);
  const ok = !!lex && named.length > 0 && cells.every((c) => c.n.value !== null && c.y !== null && (c.n.value || c.y === undefined)) && !!role.value && e !== null;
  const x: Edition[] = cells.flatMap((c) => (c.n.value ? [c.y ? ([c.n.value, c.y] as Edition) : ([c.n.value] as Edition)] : []));
  const spec: CustomSpec | null = ok ? { t: "editions", v: 1, p: { x, r: role.value!, ...(e ? { e } : {}) } } : null;

  // Anything not yet typed: the example's (the names as the placeholders say; a year stays as typed).
  const cellsOk = cells.every((c) => c.n.value !== null && c.y !== null);
  const px = cells.flatMap((c, i): Edition[] => {
    const n = orExample(c.n.value, ex.x[i]?.[0]);
    const y = c.n.value === undefined && c.y === undefined ? ex.x[i]?.[1] : c.y;
    return n ? [y ? [n, y] : [n]] : [];
  });
  useReportSpec(spec, onChange, noProblem(role) && cellsOk && e !== null && px.length > 0 && { t: "editions", v: 1, p: { x: px, r: orExample(role.value, ex.r)!, ...(e ? { e } : {}) } });

  return (
    <>
      <RowsField
        id="make-editions"
        noun="edition"
        columns={[
          { key: "n", label: "No.", max: EDITION_NAME_MAX },
          { key: "y", label: "Year", kind: "year", width: "5.5rem" },
        ]}
        rows={rows}
        setRows={setRows}
        max={EDITIONS_MAX}
        errors={errors}
        placeholders={ex.x.map(([n, y]) => ({ n, y: y ? String(y) : "" }))}
      />
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <TextField id="make-editions-role" label="Made by" state={role} max={ROLE_MAX} placeholder={ex.r} />
        <Field label="Est." hint="optional" error={e === null ? YEARS : null} htmlFor="make-editions-est">
          <input id="make-editions-est" value={est} inputMode="numeric" maxLength={4} placeholder={String(ex.e)} onChange={(ev) => setEst(ev.target.value)} className={INPUT} />
        </Field>
      </div>
    </>
  );
}
