"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { TOO_LONG } from "@/lib/custom/kit";
import { FIRST_YEAR, LAST_YEAR, parseDate } from "@/lib/custom/specKit";
import {
  CLAUSES_MAX, CLAUSES_MIN, CLAUSE_MAX, HEAD_MAX, ITEMS_MAX, ITEM_MAX, PRODUCT, QUOTE_MAX, RECEIPT_ITEMS, RECEIPT_KINDS, REVIEWER_MAX, REVIEW_QUOTES, TERMS_CLAUSES,
  quoteFit, termsFit, type ReceiptKind,
} from "@/lib/custom/specs/receipt";
import { Field, useLexicon } from "./Field";
import { RowsField, yearOf, type Row } from "./RowsField";
import { Segmented } from "./Segmented";
import { TextField, checkText, useText } from "./TextField";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const KIND_NAMES: Record<ReceiptKind, string> = { receipt: "Receipt", terms: "Terms", review: "Review" };

/** Your Receipt: a receipt (the name, the day, the items), the terms (a heading, the clauses) or a review (stars, a quote, who, since when). */
export default function ReceiptEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "receipt" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [kind, setKind] = useState<ReceiptKind>(a?.k ?? "receipt");
  const head = useText(a?.h ?? "", HEAD_MAX, lex, { required: kind === "terms" ? "Type a heading" : "Type a name for the top", touched });
  const [date, setDate] = useState(a?.d ?? "");
  const [items, setItems] = useState<Row[]>(a?.k === "receipt" ? a.x!.map((v) => ({ v })) : RECEIPT_ITEMS.slice(0, 4).map((v) => ({ v })));
  const [clauses, setClauses] = useState<Row[]>(a?.k === "terms" ? a.x!.map((v) => ({ v })) : TERMS_CLAUSES.slice(0, 4).map((v) => ({ v })));
  const [stars, setStars] = useState<number>(a?.n ?? 5);
  const quote = useText(a?.q ?? REVIEW_QUOTES[0], QUOTE_MAX, lex, { required: "Type the review", touched });
  const by = useText(a?.by ?? "", REVIEWER_MAX, lex, { required: "Who wrote it?", touched });
  const [since, setSince] = useState(a?.y ? String(a.y) : "");

  const rows = kind === "terms" ? clauses : items;
  const max = kind === "terms" ? CLAUSE_MAX : ITEM_MAX;
  const cells = rows.map((r) => checkText(r.v, max, lex));
  const lines = cells.flatMap((c) => (c.value ? [c.value] : []));
  const few = kind === "terms" ? lines.length < CLAUSES_MIN : lines.length < 1;
  const errors = cells.map((c, i) => ({ v: c.error ?? (touched && few && !c.value && i < (kind === "terms" ? CLAUSES_MIN : 1) ? (kind === "terms" ? `At least ${CLAUSES_MIN} clauses` : "Add an item") : null) }));
  const termsLong = kind === "terms" && !few && !termsFit(lines) ? TOO_LONG : null;
  const quoteLong = quote.value && !quoteFit(quote.value) ? TOO_LONG : null;
  const dateOk = kind === "receipt" ? !!parseDate(date) : !date || !!parseDate(date);
  const y = yearOf(since, FIRST_YEAR, LAST_YEAR);
  const rowsOk = cells.every((c) => c.value !== null) && !few;

  let spec: CustomSpec | null = null;
  if (lex) {
    if (kind === "review") spec = quote.value && !quoteLong && by.value && y !== null ? { t: "receipt", v: 1, p: { k: "review", n: stars, q: quote.value, by: by.value, ...(y ? { y } : {}) } } : null;
    else if (head.value && rowsOk && dateOk && !termsLong) spec = kind === "terms" ? { t: "receipt", v: 1, p: { k: "terms", h: head.value, x: lines, ...(date ? { d: date } : {}) } } : { t: "receipt", v: 1, p: { k: "receipt", h: head.value, x: lines, d: date } };
  }

  useReportSpec(spec, onChange);

  const ours = kind === "terms" ? TERMS_CLAUSES : RECEIPT_ITEMS;
  return (
    <>
      <Segmented label="Make" options={RECEIPT_KINDS} value={kind} onChange={setKind} format={(k) => KIND_NAMES[k]} />
      {kind === "review" ? (
        <>
          <Segmented label="Stars" options={[1, 2, 3, 4, 5] as const} value={stars as 1 | 2 | 3 | 4 | 5} onChange={setStars} />
          <TextField id="make-receipt-quote" label="The review" state={{ ...quote, error: quote.error ?? quoteLong }} max={QUOTE_MAX} suggestions={REVIEW_QUOTES} rows={2} />
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <TextField id="make-receipt-by" label="Reviewed by" state={by} max={REVIEWER_MAX} placeholder="Noa" />
            <Field label="Partner since" hint="optional" error={y === null ? `A year between ${FIRST_YEAR} and ${LAST_YEAR}` : null} htmlFor="make-receipt-since">
              <input id="make-receipt-since" value={since} inputMode="numeric" maxLength={4} placeholder="2016" onChange={(e) => setSince(e.target.value)} className={INPUT} />
            </Field>
          </div>
        </>
      ) : (
        <>
          <TextField id="make-receipt-head" label={kind === "terms" ? "Heading" : "At the top"} state={head} max={HEAD_MAX} placeholder={kind === "terms" ? "The Terms of Us" : ex.h} />
          <Field label={kind === "terms" ? "In effect from" : "The day"} hint={kind === "terms" ? "optional" : "its barcode"} error={dateOk || !touched ? null : "A day between 1900 and 2100"} htmlFor="make-receipt-date">
            <input id="make-receipt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          </Field>
          <RowsField
            id="make-receipt"
            noun={kind === "terms" ? "clause" : "item"}
            columns={[{ key: "v", label: kind === "terms" ? "Clause" : "Item", max, suggestions: ours }]}
            rows={rows}
            setRows={kind === "terms" ? setClauses : setItems}
            min={kind === "terms" ? CLAUSES_MIN : 1}
            max={kind === "terms" ? CLAUSES_MAX : ITEMS_MAX}
            errors={errors}
          />
          {termsLong && <p className="text-xs font-medium text-white">{termsLong}</p>}
        </>
      )}
    </>
  );
}
