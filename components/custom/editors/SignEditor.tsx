"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { PICTOGRAMS, PICTOGRAM_NAMES, type Pictogram } from "@/lib/custom/draw/pictograms";
import { ARC_MAX, PLAQUE_LINES, PLAQUE_LINE_MAX, SIGN_LINE_MAX, SIGN_STYLES, STREET_MAX, type SignStyle } from "@/lib/custom/specs/sign";
import { Field, useLexicon } from "./Field";
import { RowsField, type Row } from "./RowsField";
import { Segmented, Switch } from "./Segmented";
import { TextField, checkText, noProblem, useText } from "./TextField";
import { orExample, rowsOrExample, useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const STYLE_NAMES: Record<SignStyle, string> = { street: "Street sign", plaque: "Round plaque", warning: "Warning" };
/** The plaque's lines as the placeholders show them (and the preview prints them, until the visitor's own). */
const PLAQUE_EXAMPLE = ["Reader of maps", "and eater of toast", "1990 to date"];

/** Your Sign: a street sign (a name, a line), a round plaque (words round the top, three lines) or a warning (a pictogram, a line). */
export default function SignEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "sign" ? arrival.p : null;
  const lex = useLexicon(true);
  const [style, setStyle] = useState<SignStyle>(a?.s ?? "warning");
  const street = useText(a?.s === "street" ? a.n! : "", STREET_MAX, lex, { required: "Add the street’s name.", touched });
  const under = useText(a?.s === "street" ? (a.l ?? "") : "", SIGN_LINE_MAX, lex);
  const arc = useText(a?.s === "plaque" ? a.n! : "", ARC_MAX, lex, { required: "Add the words round the top.", touched });
  const [rows, setRows] = useState<Row[]>(a?.s === "plaque" ? a.x!.map((v) => ({ v })) : [{ v: "" }]);
  const [pc, setPc] = useState<Pictogram>(a?.pc ?? "mug");
  const [panel, setPanel] = useState(a ? a.pn === 1 : true);
  const warn = useText(a?.s === "warning" ? a.l! : "", SIGN_LINE_MAX, lex, { required: "Add the warning.", touched });

  const cells = rows.map((r) => checkText(r.v, PLAQUE_LINE_MAX, lex));
  const lines = cells.flatMap((c) => (c.value ? [c.value] : []));
  let spec: CustomSpec | null = null;
  if (lex) {
    if (style === "street" && street.value && under.ok) spec = { t: "sign", v: 1, p: { s: "street", n: street.value, ...(under.value ? { l: under.value } : {}) } };
    if (style === "plaque" && arc.value && lines.length && cells.every((c) => c.value !== null)) spec = { t: "sign", v: 1, p: { s: "plaque", n: arc.value, x: lines } };
    if (style === "warning" && warn.value) spec = { t: "sign", v: 1, p: { s: "warning", pc, l: warn.value, ...(panel ? { pn: 1 as const } : {}) } };
  }

  // Anything not yet typed: what the placeholders say.
  let preview: CustomSpec | null = null;
  if (!spec && lex && noProblem(street, under, arc, warn) && cells.every((c) => c.value !== null)) {
    if (style === "street") preview = { t: "sign", v: 1, p: { s: "street", n: orExample(street.value, "Maya Lane")!, ...(under.value ? { l: under.value } : {}) } };
    if (style === "plaque") preview = { t: "sign", v: 1, p: { s: "plaque", n: orExample(arc.value, "Maya Cohen lived here")!, x: lines.length ? lines : rowsOrExample(cells.map((c) => c.value), PLAQUE_EXAMPLE) } };
    if (style === "warning") preview = { t: "sign", v: 1, p: { s: "warning", pc, l: orExample(warn.value, "Not before the first coffee")!, ...(panel ? { pn: 1 as const } : {}) } };
  }

  useReportSpec(spec, onChange, preview);

  return (
    <>
      <Segmented label="Sign" options={SIGN_STYLES} value={style} onChange={setStyle} format={(s) => STYLE_NAMES[s]} />
      {style === "street" && (
        <>
          <TextField id="make-sign-street" label="The street" state={street} max={STREET_MAX} placeholder="Maya Lane" />
          <TextField id="make-sign-under" label="The line under it" hint="optional" state={under} max={SIGN_LINE_MAX} placeholder="No through road" />
        </>
      )}
      {style === "plaque" && (
        <>
          <TextField id="make-sign-arc" label="Round the top" state={arc} max={ARC_MAX} placeholder="Maya Cohen lived here" />
          <RowsField id="make-sign" noun="line" columns={[{ key: "v", label: "Line", max: PLAQUE_LINE_MAX }]} rows={rows} setRows={setRows} max={PLAQUE_LINES} errors={cells.map((c, i) => ({ v: c.error ?? (touched && i === 0 && !lines.length ? "Add a line." : null) }))} placeholders={PLAQUE_EXAMPLE.map((v) => ({ v }))} />
        </>
      )}
      {style === "warning" && (
        <>
          <Field label="Pictogram" htmlFor="make-sign-pictogram">
            <select id="make-sign-pictogram" value={pc} onChange={(e) => setPc(e.target.value as Pictogram)} className={INPUT}>
              {PICTOGRAMS.map((p) => (
                <option key={p} value={p}>
                  {PICTOGRAM_NAMES[p]}
                </option>
              ))}
            </select>
          </Field>
          <TextField id="make-sign-warning" label="Under CAUTION" state={warn} max={SIGN_LINE_MAX} placeholder="Not before the first coffee" />
          <Switch label="On a panel" checked={panel} onChange={setPanel} />
        </>
      )}
    </>
  );
}
