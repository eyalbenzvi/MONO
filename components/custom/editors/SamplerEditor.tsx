"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { TOO_LONG } from "@/lib/custom/kit";
import { BORDERS, BORDER_NAMES, MOTIFS, MOTIF_NAMES, type Border, type Motif } from "@/lib/custom/draw/sampler";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/custom/specKit";
import { PRODUCT, SAMPLER_NAME_MAX, SAMPLER_WORDS_MAX, STITCHABLE, wordRows } from "@/lib/custom/specs/sampler";
import { Field, useLexicon } from "./Field";
import { yearOf } from "./RowsField";
import { TextField, allOk, useText } from "./TextField";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const STITCH_LINE = "Letters, figures and . ! ? : - only: the stitches the sampler has.";

/** Your Sampler: the name, the year, a line of words, the border and one to three motifs. */
export default function SamplerEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "sampler" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const name = useText(a?.n ?? "", SAMPLER_NAME_MAX, lex, { required: "Type a name", touched });
  const words = useText(a?.w ?? "", SAMPLER_WORDS_MAX, lex);
  const [year, setYear] = useState(a?.y ? String(a.y) : "");
  const [b, setB] = useState<Border>(a?.b ?? "diamonds");
  const [mo, setMo] = useState<(Motif | "")[]>(a ? [a.mo[0], a.mo[1] ?? "", a.mo[2] ?? ""] : ["tree", "heart", "house"]);
  const y = yearOf(year, FIRST_YEAR, LAST_YEAR);
  // The pixel font has no accents: a letter it lacks is refused here, not left blank.
  const nameBad = name.value && !STITCHABLE.test(name.value) ? STITCH_LINE : null;
  const wordsBad = words.value ? (!STITCHABLE.test(words.value) ? STITCH_LINE : !wordRows(words.value) ? TOO_LONG : null) : null;
  const motifs = mo.filter((m): m is Motif => !!m);
  const ok = allOk(lex, name, words) && !!name.value && !nameBad && !wordsBad && y !== null && motifs.length > 0;
  const spec: CustomSpec | null = ok ? { t: "sampler", v: 1, p: { n: name.value!, ...(y ? { y } : {}), ...(words.value ? { w: words.value } : {}), b, mo: motifs } } : null;

  useReportSpec(spec, onChange);

  return (
    <>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <TextField id="make-sampler-name" label="Name" state={{ ...name, error: name.error ?? nameBad }} max={SAMPLER_NAME_MAX} placeholder={ex.n} />
        <Field label="Year" hint="optional" error={y === null ? `A year between ${FIRST_YEAR} and ${LAST_YEAR}` : null} htmlFor="make-sampler-year">
          <input id="make-sampler-year" value={year} inputMode="numeric" maxLength={4} placeholder={String(ex.y)} onChange={(e) => setYear(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <TextField id="make-sampler-words" label="A line of words" hint="optional" state={{ ...words, error: words.error ?? wordsBad }} max={SAMPLER_WORDS_MAX} placeholder={ex.w} />
      <Field label="Border" htmlFor="make-sampler-border">
        <select id="make-sampler-border" value={b} onChange={(e) => setB(e.target.value as Border)} className={INPUT}>
          {BORDERS.map((v) => (
            <option key={v} value={v}>
              {BORDER_NAMES[v]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        {mo.map((m, i) => (
          <Field key={i} label={["Left", "Middle", "Right"][i]} hint={i ? "optional" : undefined} error={i === 0 && touched && !motifs.length ? "Choose a motif" : null} htmlFor={`make-sampler-motif${i}`}>
            <select id={`make-sampler-motif${i}`} value={m} onChange={(e) => setMo(mo.map((x, j) => (j === i ? (e.target.value as Motif | "") : x)))} className={INPUT}>
              <option value="">None</option>
              {MOTIFS.map((v) => (
                <option key={v} value={v}>
                  {MOTIF_NAMES[v]}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
    </>
  );
}
