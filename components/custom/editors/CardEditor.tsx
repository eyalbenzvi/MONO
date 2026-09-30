"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { CARD_CONTACT_MAX, CARD_LINE_MAX, CARD_NAME_MAX, CARD_STYLES, PRODUCT, type CardStyle } from "@/lib/custom/specs/card";
import { useLexicon } from "./Field";
import { Segmented } from "./Segmented";
import { TextField, allOk, useText } from "./TextField";
import { useReportSpec } from "./useReportSpec";
import type { EditorProps } from "./types";

const STYLE_NAMES: Record<CardStyle, string> = { classic: "Classic", modern: "Modern", bone: "Bone" };

/** Your Business Card: the name, the title, the company, a contact line, and the style. */
export default function CardEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "card" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const name = useText(a?.n ?? "", CARD_NAME_MAX, lex, { required: "Type a name", touched });
  const title = useText(a?.ti ?? "", CARD_LINE_MAX, lex, { required: "Type a title", touched });
  const company = useText(a?.co ?? "", CARD_LINE_MAX, lex, { required: "Type a company", touched });
  const contact = useText(a?.ct ?? "", CARD_CONTACT_MAX, lex);
  const [style, setStyle] = useState<CardStyle>(a?.s ?? "classic");
  const ok = allOk(lex, name, title, company, contact) && !!name.value && !!title.value && !!company.value;
  const spec: CustomSpec | null = ok ? { t: "card", v: 1, p: { n: name.value!, ti: title.value!, co: company.value!, ...(contact.value ? { ct: contact.value } : {}), s: style } } : null;

  useReportSpec(spec, onChange);

  return (
    <>
      <Segmented label="Style" options={CARD_STYLES} value={style} onChange={setStyle} format={(s) => STYLE_NAMES[s]} />
      <TextField id="make-card-name" label="Name" state={name} max={CARD_NAME_MAX} placeholder={ex.n} />
      <TextField id="make-card-title" label="Title" state={title} max={CARD_LINE_MAX} placeholder={ex.ti} />
      <TextField id="make-card-company" label="Company" state={company} max={CARD_LINE_MAX} placeholder={ex.co} />
      <TextField id="make-card-contact" label="Contact line" hint="optional" state={contact} max={CARD_CONTACT_MAX} placeholder={ex.ct} />
      <p className="text-xs text-neutral-400">The contact line prints on the shirt, for anyone to read. A number or an address is yours to put there, or not.</p>
    </>
  );
}
