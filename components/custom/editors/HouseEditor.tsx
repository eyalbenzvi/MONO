"use client";

import { useState } from "react";
import { DOORS, ROOFS, type CustomSpec, type Door, type Roof } from "@/lib/custom/spec";
import { Field, WordsField, useWords } from "./Field";
import { Segmented, Stepper } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const ROOF_LABEL: Record<Roof, string> = { flat: "Flat", pitched: "Pitched", stepped: "Stepped", dome: "Dome" };
const DOOR_LABEL: Record<Door, string> = { l: "Left", c: "Centre", r: "Right" };

/** Your House: floors and windows (steppers), the roof, where the door is, the number on it, the words. */
export default function HouseEditor({ made, arrival, onChange }: EditorProps) {
  const a = arrival?.t === "house" ? arrival.p : null;
  const [fl, setFl] = useState(a?.fl ?? 3);
  const [wn, setWn] = useState(a?.wn ?? 3);
  const [r, setR] = useState<Roof>(a?.r ?? "pitched");
  const [dr, setDr] = useState<Door>(a?.dr ?? "c");
  const [no, setNo] = useState(a ? (a.no !== undefined ? String(a.no) : "") : "14");
  const words = useWords(a?.w ?? "");

  const n = no.trim();
  const number = n === "" ? undefined : /^\d{1,4}$/.test(n) ? Number(n) : null;
  const w = words.value;
  const spec: CustomSpec | null = number !== null && w !== null ? { t: "house", v: 1, p: { fl, wn, r, dr, ...(number !== undefined ? { no: number } : {}), ...(w ? { w } : {}) } } : null;
  useReportSpec(spec, onChange);

  return (
    <>
      <div className="flex flex-wrap gap-6">
        <Stepper label="Floors" value={fl} min={1} max={12} onChange={setFl} />
        <Stepper label="Windows across" value={wn} min={1} max={9} onChange={setWn} />
      </div>
      <Segmented label="Roof" options={ROOFS} value={r} onChange={setR} format={(x) => ROOF_LABEL[x]} />
      <Segmented label="Door" options={DOORS} value={dr} onChange={setDr} format={(x) => DOOR_LABEL[x]} />
      <Field label="Number" hint="optional" error={number === null ? "Up to four digits" : null} htmlFor="make-house-no">
        <input id="make-house-no" value={no} inputMode="numeric" maxLength={4} autoComplete="off" placeholder="14" onChange={(e) => setNo(e.target.value)} aria-invalid={number === null} className={`${INPUT} font-mono`} />
      </Field>
      <WordsField words={words} hint={made.wordsHint ?? ""} />
    </>
  );
}
