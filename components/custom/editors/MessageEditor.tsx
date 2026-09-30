"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { TOO_LONG } from "@/lib/custom/kit";
import { parseDate, parseTime } from "@/lib/custom/specKit";
import { MESSAGES_MAX, MESSAGES_MIN, MESSAGE_MAX, PRODUCT, WITH_MAX, threadFit, type Message } from "@/lib/custom/specs/message";
import { Field, useLexicon } from "./Field";
import { RowsField, type Row } from "./RowsField";
import { TextField, checkText, useText } from "./TextField";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const SIDES = [
  { value: "0", label: "Them" },
  { value: "1", label: "You" },
] as const;

/** Your First Message: who it's with, the day, and the messages (whose, what, when), two to six. */
export default function MessageEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "message" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const who = useText(a?.n ?? "", WITH_MAX, lex);
  const [date, setDate] = useState(a?.d ?? "");
  const [rows, setRows] = useState<Row[]>(a ? a.m.map(([s, t, h]) => ({ s: String(s), t, h })) : [{ s: "0", t: "", h: "" }, { s: "1", t: "", h: "" }]);
  const cells = rows.map((r) => ({ t: checkText(r.t, MESSAGE_MAX, lex), h: r.h.trim() ? (parseTime(r.h.trim()) ? r.h.trim() : null) : undefined }));
  const done = cells.filter((c) => c.t.value && c.h);
  const few = done.length < MESSAGES_MIN;
  const errors = cells.map((c, i) => ({
    t: c.t.error ?? (touched && !c.t.value && (few && i < MESSAGES_MIN || c.h) ? "Type the message" : null),
    h: c.h === null ? "A time as 21:04" : touched && !c.h && (c.t.value || (few && i < MESSAGES_MIN)) ? "When?" : null,
  }));
  const m: Message[] = rows.flatMap((r, i) => (cells[i].t.value && cells[i].h ? [[r.s === "1" ? 1 : 0, cells[i].t.value!, cells[i].h!] as Message] : []));
  const tooLong = !few && !threadFit(m) ? TOO_LONG : null;
  const dateOk = !date || !!parseDate(date);
  const half = cells.some((c) => !!c.t.value !== !!c.h);
  const ok = !!lex && !few && !half && !tooLong && dateOk && who.value !== null && cells.every((c) => c.t.value !== null && c.h !== null);
  const spec: CustomSpec | null = ok ? { t: "message", v: 1, p: { m, ...(who.value ? { n: who.value } : {}), ...(date ? { d: date } : {}) } } : null;

  useReportSpec(spec, onChange);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextField id="make-message-with" label="With" hint="optional" state={who} max={WITH_MAX} placeholder={ex.n} />
        <Field label="The day" hint="optional" error={dateOk ? null : "A day between 1900 and 2100"} htmlFor="make-message-date">
          <input id="make-message-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <RowsField
        id="make-message"
        noun="message"
        columns={[
          { key: "s", label: "From", kind: SIDES, width: "5.5rem" },
          { key: "t", label: "Message", max: MESSAGE_MAX },
          { key: "h", label: "Time", kind: "time", width: "5rem" },
        ]}
        rows={rows}
        setRows={setRows}
        min={MESSAGES_MIN}
        max={MESSAGES_MAX}
        errors={errors}
        placeholders={ex.m.map(([s, t, h]) => ({ s: String(s), t, h }))}
      />
      {tooLong && <p className="text-xs font-medium text-white">{tooLong}</p>}
    </>
  );
}
