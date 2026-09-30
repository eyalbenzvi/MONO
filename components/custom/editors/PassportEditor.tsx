"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadCountries, type Countries } from "@/lib/custom/data";
import type { CustomSpec } from "@/lib/custom/spec";
import { parseDate } from "@/lib/custom/specKit";
import { COUNTRY_CODES } from "@/lib/custom/specs/countries";
import { PASSPORT_MAX, PASSPORT_NAME_MAX, PRODUCT, type Stamp } from "@/lib/custom/specs/passport";
import { useLexicon } from "./Field";
import { RowsField, type Column, type Row } from "./RowsField";
import { TextField, allOk, useText } from "./TextField";
import type { EditorProps } from "./types";

const BY = [
  { value: "air", label: "By air" },
  { value: "train", label: "By train" },
] as const;

const rowOf = ([c, d, t]: Stamp): Row => ({ c, d: typeof d === "string" ? d : "", by: t ? "train" : "air" });

/** Your Passport: whose page, and up to ten stamps (a country, the day, by air or by train). */
export default function PassportEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "passport" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [countries, setCountries] = useState<Countries | null>(null);
  useEffect(() => {
    let live = true;
    loadCountries()
      .then((c) => live && setCountries(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const name = useText(a?.n ?? "", PASSPORT_NAME_MAX, lex, { required: "Whose passport?", touched });
  const [rows, setRows] = useState<Row[]>(a ? a.x.map(rowOf) : [{ c: "", d: "", by: "air" }]);
  const choices = useMemo(() => {
    const list = (countries?.list ?? []).filter((c) => (COUNTRY_CODES as readonly string[]).includes(c.a3)).sort((m, n) => (m.name < n.name ? -1 : 1));
    return [{ value: "", label: countries ? "Choose a country" : "Loading countries…" }, ...list.map((c) => ({ value: c.a3, label: c.name }))];
  }, [countries]);
  const columns: Column[] = [
    { key: "c", label: "Country", kind: choices, width: "1.6fr" },
    { key: "d", label: "Day", kind: "date", width: "1.3fr" },
    { key: "by", label: "How", kind: BY, width: "1fr" },
  ];
  const errors = rows.map((r) => ({ c: touched && !r.c ? "Choose a country" : null, d: r.d && !parseDate(r.d) ? "A day from 1900 to 2100" : null }));
  const stamps = rows.every((r) => r.c && (!r.d || parseDate(r.d))) ? rows.map((r): Stamp => (r.by === "train" ? [r.c, r.d || 0, 1] : r.d ? [r.c, r.d] : [r.c])) : null;
  const ok = allOk(lex, name) && !!name.value && !!stamps && stamps.length > 0;
  const spec: CustomSpec | null = ok ? { t: "passport", v: 1, p: { n: name.value!, x: stamps! } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: countries ? { countries } : {} });
  }, [key, countries]);

  return (
    <>
      <TextField id="make-passport-name" label="Whose passport" state={name} max={PASSPORT_NAME_MAX} placeholder={ex.n} />
      <RowsField id="make-passport" noun="stamp" columns={columns} rows={rows} setRows={setRows} max={PASSPORT_MAX} errors={errors} />
    </>
  );
}
