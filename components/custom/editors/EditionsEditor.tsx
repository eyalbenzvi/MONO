"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/custom/specKit";
import { EDITIONS_MAX, EDITION_NAME_MAX, PRODUCT, ROLE_MAX, type Edition } from "@/lib/custom/specs/editions";
import { Field, useLexicon } from "./Field";
import { RowsField, yearOf, type Row } from "./RowsField";
import { TextField, checkText, useText } from "./TextField";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const YEARS = `A year between ${FIRST_YEAR} and ${LAST_YEAR}`;

/** Limited Editions: the editions in order (a name, a year), the maker on the seal, the year the series began. */
export default function EditionsEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "editions" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [rows, setRows] = useState<Row[]>(a ? a.x.map(([n, y]) => ({ n, y: y ? String(y) : "" })) : [{ n: "", y: "" }, { n: "", y: "" }]);
  const role = useText(a?.r ?? "", ROLE_MAX, lex, { required: "Who made them?", touched });
  const [est, setEst] = useState(a?.e ? String(a.e) : "");
  const cells = rows.map((r) => ({ n: checkText(r.n, EDITION_NAME_MAX, lex), y: yearOf(r.y, FIRST_YEAR, LAST_YEAR) }));
  const errors = cells.map((c, i) => ({ n: c.n.error ?? (c.n.value === undefined && ((touched && i === 0) || c.y !== undefined) ? "Type a name" : null), y: c.y === null ? YEARS : null }));
  const e = yearOf(est, FIRST_YEAR, LAST_YEAR);
  const named = cells.filter((c) => c.n.value);
  const ok = !!lex && named.length > 0 && cells.every((c) => c.n.value !== null && c.y !== null && (c.n.value || c.y === undefined)) && !!role.value && e !== null;
  const x: Edition[] = cells.flatMap((c) => (c.n.value ? [c.y ? ([c.n.value, c.y] as Edition) : ([c.n.value] as Edition)] : []));
  const spec: CustomSpec | null = ok ? { t: "editions", v: 1, p: { x, r: role.value!, ...(e ? { e } : {}) } } : null;

  useReportSpec(spec, onChange);

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
