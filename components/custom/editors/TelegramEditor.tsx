"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { TOO_LONG } from "@/lib/custom/kit";
import { PRODUCT, TELEGRAM_MAX, TELEGRAM_NAME_MAX, telegramFit } from "@/lib/custom/specs/telegram";
import { parseDate } from "@/lib/custom/specKit";
import { Field, useLexicon } from "./Field";
import { TextField, allOk, noProblem, useText } from "./TextField";
import { orExample, useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Your Telegram: to, from, the day it was sent, and the message (it prints in capitals, the full stops as STOP). */
export default function TelegramEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "telegram" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const to = useText(a?.to ?? "", TELEGRAM_NAME_MAX, lex, { required: "Add who it’s to.", touched });
  const fr = useText(a?.fr ?? "", TELEGRAM_NAME_MAX, lex);
  const msg = useText(a?.m ?? "", TELEGRAM_MAX, lex, { required: "Add the message.", touched });
  const [date, setDate] = useState(a?.d ?? "");
  const dateOk = !date || !!parseDate(date);
  const tooLong = msg.value && !telegramFit(msg.value) ? TOO_LONG : null;
  const ok = allOk(lex, to, fr, msg) && dateOk && !tooLong && !!to.value && !!msg.value;
  const make = (to: string | null, m: string | null): CustomSpec => ({ t: "telegram", v: 1, p: { to: to!, ...(fr.value ? { fr: fr.value } : {}), ...(date ? { d: date } : {}), m: m! } });
  const spec: CustomSpec | null = ok ? make(to.value!, msg.value!) : null;

  // Who it's to or the message not yet typed: the example's.
  useReportSpec(spec, onChange, noProblem(to, fr, msg) && dateOk && !tooLong && make(orExample(to.value, ex.to), orExample(msg.value, ex.m)));

  return (
    <>
      <TextField id="make-telegram-to" label="To" state={to} max={TELEGRAM_NAME_MAX} placeholder={ex.to} />
      <TextField id="make-telegram-from" label="From" hint="optional" state={fr} max={TELEGRAM_NAME_MAX} placeholder={ex.fr} />
      <Field label="Sent" hint="optional" error={dateOk ? null : "Between 1900 and 2100."} htmlFor="make-telegram-date">
        <input id="make-telegram-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
      </Field>
      <TextField id="make-telegram-message" label="Message" hint={`up to ${TELEGRAM_MAX} characters; full stops print as STOP`} state={{ ...msg, error: msg.error ?? tooLong }} max={TELEGRAM_MAX} placeholder={ex.m} rows={4} />
    </>
  );
}
