"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { TOO_LONG } from "@/lib/custom/kit";
import { EMBLEMS, EMBLEM_NAMES, type Emblem } from "@/lib/custom/draw/emblems";
import { parseDate } from "@/lib/custom/specKit";
import { CREW_LINE_MAX, CREW_MAX, CREW_NAME_MAX, MISSION_MAX, PRODUCT, crewLine } from "@/lib/custom/specs/patch";
import { Field, useLexicon } from "./Field";
import { RowsField, type Row } from "./RowsField";
import { TextField, checkText, useText } from "./TextField";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Your Mission Patch: the mission, the crew (one to six), the emblem, the day. */
export default function PatchEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "patch" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const mission = useText(a?.m ?? "", MISSION_MAX, lex, { required: "Name the mission", touched });
  const [rows, setRows] = useState<Row[]>(a ? a.x.map((n) => ({ n })) : [{ n: "" }, { n: "" }]);
  const [e, setE] = useState<Emblem>(a?.e ?? "rocket");
  const [date, setDate] = useState(a?.d ?? "");
  const cells = rows.map((r) => checkText(r.n, CREW_NAME_MAX, lex));
  const crew = cells.flatMap((c) => (c.value ? [c.value] : []));
  const tooLong = crew.length && crewLine(crew).length > CREW_LINE_MAX ? TOO_LONG : null;
  const dateOk = !date || !!parseDate(date);
  const ok = !!lex && !!mission.value && crew.length > 0 && cells.every((c) => c.value !== null) && !tooLong && dateOk;
  const spec: CustomSpec | null = ok ? { t: "patch", v: 1, p: { m: mission.value!, x: crew, e, ...(date ? { d: date } : {}) } } : null;

  useReportSpec(spec, onChange);

  return (
    <>
      <TextField id="make-patch-mission" label="The mission" state={mission} max={MISSION_MAX} placeholder={ex.m} />
      <RowsField id="make-patch" noun="crew member" columns={[{ key: "n", label: "Crew", max: CREW_NAME_MAX }]} rows={rows} setRows={setRows} max={CREW_MAX} errors={cells.map((c, i) => ({ n: c.error ?? (touched && i === 0 && !crew.length ? "Name the crew" : null) }))} placeholders={ex.x.map((n) => ({ n }))} />
      {tooLong && <p className="text-xs font-medium text-white">{tooLong}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Emblem" htmlFor="make-patch-emblem">
          <select id="make-patch-emblem" value={e} onChange={(ev) => setE(ev.target.value as Emblem)} className={INPUT}>
            {EMBLEMS.map((v) => (
              <option key={v} value={v}>
                {EMBLEM_NAMES[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Launched" hint="optional" error={dateOk ? null : "A day between 1900 and 2100"} htmlFor="make-patch-date">
          <input id="make-patch-date" type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={INPUT} />
        </Field>
      </div>
    </>
  );
}
