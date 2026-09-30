"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { TOO_LONG } from "@/lib/custom/kit";
import { HEADLINES, HEADLINE_MAX, PAPER_NAME_MAX, PRODUCT, STANDFIRST_MAX, headlineFit, standfirstFit } from "@/lib/custom/specs/frontpage";
import { parseDate } from "@/lib/custom/specKit";
import { Field, useLexicon } from "./Field";
import { TextField, allOk, useText } from "./TextField";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Your Front Page: whose paper (The Daily …), the headline (ours or yours), a standfirst and the day. */
export default function FrontpageEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "frontpage" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const name = useText(a?.n ?? "", PAPER_NAME_MAX, lex, { required: "Whose paper?", touched });
  const head = useText(a?.h ?? "", HEADLINE_MAX, lex, { required: "Write the headline", touched });
  const stand = useText(a?.s ?? "", STANDFIRST_MAX, lex);
  const [date, setDate] = useState(a?.d ?? "");
  const dateOk = !date || !!parseDate(date);
  const headLong = head.value && !headlineFit(head.value) ? TOO_LONG : null;
  const standLong = stand.value && !standfirstFit(stand.value) ? TOO_LONG : null;
  const ok = allOk(lex, name, head, stand) && dateOk && !headLong && !standLong && !!name.value && !!head.value;
  const spec: CustomSpec | null = ok ? { t: "frontpage", v: 1, p: { n: name.value!, h: head.value!, ...(stand.value ? { s: stand.value } : {}), ...(date ? { d: date } : {}) } } : null;

  useReportSpec(spec, onChange);

  return (
    <>
      <TextField id="make-frontpage-name" label="The Daily…" hint="whose paper" state={name} max={PAPER_NAME_MAX} placeholder={ex.n} />
      <TextField id="make-frontpage-headline" label="Headline" hint="ours, or yours" state={{ ...head, error: head.error ?? headLong }} max={HEADLINE_MAX} placeholder={ex.h} suggestions={HEADLINES} />
      <TextField id="make-frontpage-standfirst" label="Standfirst" hint="optional: the line under the headline" state={{ ...stand, error: stand.error ?? standLong }} max={STANDFIRST_MAX} placeholder={ex.s} rows={2} />
      <Field label="The day" hint="optional" error={dateOk ? null : "A day between 1900 and 2100"} htmlFor="make-frontpage-date">
        <input id="make-frontpage-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
      </Field>
    </>
  );
}
