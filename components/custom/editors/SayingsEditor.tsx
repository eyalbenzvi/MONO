"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { TOO_LONG } from "@/lib/custom/kit";
import { parseDate } from "@/lib/custom/specKit";
import { PRODUCT, SAYER_MAX, SAYINGS_MAX, SAYINGS_MIN, SAYING_MAX, WORD_MAX, sayingsFit } from "@/lib/custom/specs/sayings";
import { Field, useLexicon } from "./Field";
import { RowsField, type Row } from "./RowsField";
import { Segmented } from "./Segmented";
import { TextField, checkText, useText } from "./TextField";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Things They Say: who says them and their sayings (3 to 7); or first words, the word and the day. */
export default function SayingsEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "sayings" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [mode, setMode] = useState<"sayings" | "first">(a?.k === "first" ? "first" : "sayings");
  const first = mode === "first";
  const who = useText(a?.n ?? "", SAYER_MAX, lex, { required: first ? "Add a name." : "Add who says them.", touched });
  const [rows, setRows] = useState<Row[]>(a?.x ? a.x.map((s) => ({ s })) : Array.from({ length: SAYINGS_MIN }, () => ({ s: "" })));
  const word = useText(a?.o ?? "", WORD_MAX, lex, { required: "Add the word.", touched });
  const [date, setDate] = useState(a?.d ?? "");
  const cells = rows.map((r) => checkText(r.s, SAYING_MAX, lex));
  const said = cells.flatMap((c) => (c.value ? [c.value] : []));
  const short = said.length < SAYINGS_MIN;
  const tooLong = !short && cells.every((c) => c.value !== null) && !sayingsFit(said) ? TOO_LONG : null;
  const errors = cells.map((c, i) => ({ s: c.error ?? (touched && short && !c.value && i < SAYINGS_MIN ? `At least ${SAYINGS_MIN} sayings.` : null) }));
  const dateOk = !date || !!parseDate(date);
  let spec: CustomSpec | null = null;
  if (lex && who.value) {
    if (first) spec = word.value && dateOk ? { t: "sayings", v: 1, p: { k: "first", n: who.value, o: word.value, ...(date ? { d: date } : {}) } } : null;
    else spec = !short && !tooLong && cells.every((c) => c.value !== null) ? { t: "sayings", v: 1, p: { n: who.value, x: said } } : null;
  }

  useReportSpec(spec, onChange);

  return (
    <>
      <Segmented label="Make" options={["sayings", "first"] as const} value={mode} onChange={setMode} format={(m) => (m === "first" ? "First words" : "Their sayings")} />
      <TextField id="make-sayings-who" label={first ? "Name" : "Who says them"} state={who} max={SAYER_MAX} placeholder={first ? "Noa" : ex.n} />
      {first ? (
        <>
          <TextField id="make-sayings-word" label="The word" state={word} max={WORD_MAX} placeholder="Banana" />
          <Field label="The day" hint="optional" error={dateOk ? null : "Between 1900 and 2100."} htmlFor="make-sayings-date">
            <input id="make-sayings-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          </Field>
        </>
      ) : (
        <>
          <RowsField id="make-sayings" noun="saying" columns={[{ key: "s", label: "Saying", max: SAYING_MAX }]} rows={rows} setRows={setRows} min={SAYINGS_MIN} max={SAYINGS_MAX} errors={errors} placeholders={ex.x!.map((s) => ({ s }))} />
          {tooLong && <p className="text-xs font-medium text-white">{tooLong}</p>}
        </>
      )}
    </>
  );
}
