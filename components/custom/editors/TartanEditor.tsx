"use client";

import { useEffect, useRef, useState } from "react";
import { cleanWords, type CustomSpec } from "@/lib/custom/spec";
import { deriveSett } from "@/lib/custom/draw/tartan";
import { COUNT_MAX, PRODUCT, SETT_MAX, STRIPES_MAX, STRIPES_MIN, TARTAN_NAME_MAX, TONES, parseSett, settText, type Params, type Tone } from "@/lib/custom/specs/tartan";
import { Field, WordsField, useLexicon, useWords } from "./Field";
import { Segmented, Stepper, Switch } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

const TONE_LABEL: Record<Tone, string> = { K: "Densest", D: "Dense", L: "Sparse", W: "Blank" };

/** Your Tartan: the family name; the stripes, when edited (tone and thread count each); the words. */
export default function TartanEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "tartan" ? (arrival.p as Params) : null;
  const start = a ?? PRODUCT.example;
  const [name, setName] = useState(start.n);
  const [edit, setEdit] = useState(!!start.t);
  const [stripes, setStripes] = useState<[Tone, number][]>(() => (start.t ? parseSett(start.t)! : deriveSett(start.n)));
  const words = useWords(a?.w ?? "");
  const lex = useLexicon(!!name.trim());

  const n = name.replace(/\s+/g, " ").trim();
  const nameError = !n
    ? touched
      ? "Type a family name"
      : null
    : cleanWords(n, TARTAN_NAME_MAX) !== n
      ? `Up to ${TARTAN_NAME_MAX} letters and numbers.`
      : lex
        ? lex.wordsProblem(n)
        : null;
  const t = settText(stripes);
  const same = stripes.findIndex(([tone], i) => i > 0 && tone === stripes[i - 1][0]);
  const total = stripes.reduce((s, [, c]) => s + c, 0);
  const settError = !edit ? null : same > 0 ? `Stripes ${same} and ${same + 1} are the same; change one` : total > SETT_MAX ? `Up to ${SETT_MAX} threads in all (now ${total})` : null;
  const w = words.value;
  const ok = n && !nameError && lex && !settError && (!edit || parseSett(t)) && w !== null;
  const spec: CustomSpec | null = ok ? { t: "tartan", v: 1, p: { n, ...(edit ? { t } : {}), ...(w ? { w } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  // Turning editing on starts from the name's own sett.
  const toggle = (on: boolean) => {
    if (on && n) setStripes(deriveSett(n));
    setEdit(on);
  };
  const set = (i: number, v: [Tone, number]) => setStripes((xs) => xs.map((x, j) => (j === i ? v : x)));

  return (
    <>
      <Field label="Family name" error={nameError} htmlFor="make-tartan-name">
        <input id="make-tartan-name" value={name} maxLength={TARTAN_NAME_MAX + 4} placeholder="Mackenzie" autoComplete="off" onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} className={INPUT} />
      </Field>
      <Switch label="Edit the stripes" checked={edit} onChange={toggle} />
      {edit && (
        <>
          {stripes.map(([tone, count], i) => (
            <div key={i} className="flex flex-wrap items-end gap-4">
              <Segmented label={`Stripe ${i + 1}`} options={TONES} value={tone} onChange={(v) => set(i, [v, count])} format={(v) => TONE_LABEL[v]} />
              <Stepper label={`Stripe ${i + 1} threads`} value={count} min={1} max={COUNT_MAX} onChange={(v) => set(i, [tone, v])} />
            </div>
          ))}
          {settError && <p className="text-xs text-neutral-300">{settError}</p>}
          <div className="flex gap-4">
            {stripes.length < STRIPES_MAX && (
              <button type="button" onClick={() => setStripes((xs) => [...xs, [xs[xs.length - 1][0] === "W" ? "K" : "W", 4]])} className="h-10 w-fit text-neutral-300 underline underline-offset-4 hover:text-white">
                Add a stripe
              </button>
            )}
            {stripes.length > STRIPES_MIN && (
              <button type="button" onClick={() => setStripes((xs) => xs.slice(0, -1))} className="h-10 w-fit text-neutral-300 underline underline-offset-4 hover:text-white">
                Remove the last
              </button>
            )}
          </div>
        </>
      )}
      <WordsField words={words} hint={made.wordsHint ?? PRODUCT.wordsHint ?? ""} touched={touched} />
    </>
  );
}
