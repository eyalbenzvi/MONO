"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/custom/specKit";
import { DIET_MAX, DINO_NAME_MAX, ENDINGS, HEIGHT_MAX, HEIGHT_MIN, PLATES, PLATE_INFO, PRODUCT, SPECIES, genusOf, stemOf, type Ending, type Plate, type Species } from "@/lib/custom/specs/dinosaur";
import { Field, useLexicon } from "./Field";
import { yearOf } from "./RowsField";
import { Segmented } from "./Segmented";
import { TextField, allOk, noProblem, useText } from "./TextField";
import { INPUT, type EditorProps } from "./types";
import { previewOf, usePreviewKey } from "./useReportSpec";

const DIETS = ["pasta", "toast", "raisins", "yoghurt", "everything", "nothing green", "biscuits"];

/** Your Dinosaur: the child's name, the skeleton, the name's ending and species, and the facts (discovered, height, diet). */
export default function DinosaurEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "dinosaur" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const name = useText(a?.n ?? "", DINO_NAME_MAX, lex, { required: "Add the child’s name.", touched });
  const [plate, setPlate] = useState<Plate>(a?.k ?? ex.k);
  const [ending, setEnding] = useState<Ending | "">(a?.e ?? "");
  const [species, setSpecies] = useState<Species>(a?.s ?? "rex");
  const [year, setYear] = useState(a?.y ? String(a.y) : "");
  const [height, setHeight] = useState(a?.h ? String(a.h) : "");
  const diet = useText(a?.d ?? "", DIET_MAX, lex);

  const y = yearOf(year, FIRST_YEAR, LAST_YEAR);
  const hNum = height.trim() ? Number(height.trim()) : undefined;
  const hOk = hNum === undefined || (Number.isInteger(hNum) && hNum >= HEIGHT_MIN && hNum <= HEIGHT_MAX);
  const stemOk = !name.value || stemOf(name.value).length >= 2;
  const ok = allOk(lex, name, diet) && !!name.value && stemOk && y !== null && hOk;
  const e = ending || undefined;
  const make = (n: string): CustomSpec => ({ t: "dinosaur", v: 1, p: { n, k: plate, ...(e ? { e } : {}), ...(species !== "rex" ? { s: species } : {}), ...(y ? { y } : {}), ...(hNum !== undefined ? { h: hNum } : {}), ...(diet.value ? { d: diet.value } : {}) } });
  const spec: CustomSpec | null = ok ? make(name.value!) : null;
  // No name yet: the example's, with the skeleton, the names and the facts as chosen.
  const preview = !spec && name.value === undefined && noProblem(diet) && y !== null && hOk ? make(ex.n) : null;

  const report = useRef(onChange);
  report.current = onChange;
  const specKey = spec ? JSON.stringify(spec) : "";
  const previewKey = usePreviewKey(spec, preview);
  useEffect(() => {
    report.current({ spec: specKey ? (JSON.parse(specKey) as CustomSpec) : null, data: {}, ...previewOf(previewKey) });
  }, [specKey, previewKey]);

  const sample = name.value && stemOk ? name.value : ex.n;
  return (
    <>
      <TextField id="make-dinosaur-name" label="The child’s name" hint="the new species is named after them" state={{ ...name, error: name.error ?? (stemOk ? null : "Two letters or more.") }} max={DINO_NAME_MAX} placeholder={ex.n} />
      <Field label="Skeleton" htmlFor="make-dinosaur-plate">
        <select id="make-dinosaur-plate" value={plate} onChange={(ev) => setPlate(ev.target.value as Plate)} className={INPUT}>
          {PLATES.map((k) => (
            <option key={k} value={k}>
              {PLATE_INFO[k].name} ({PLATE_INFO[k].period})
            </option>
          ))}
        </select>
      </Field>
      <Segmented label="Ending" options={["", ...ENDINGS] as const} value={ending} onChange={setEnding} format={(o) => (o ? genusOf(sample, o) : `${genusOf(sample, PLATE_INFO[plate].ending)} (the skeleton’s)`)} />
      <Field label="Species" htmlFor="make-dinosaur-species">
        <select id="make-dinosaur-species" value={species} onChange={(ev) => setSpecies(ev.target.value as Species)} className={INPUT}>
          {(Object.keys(SPECIES) as Species[]).map((s) => (
            <option key={s} value={s}>
              {s} ({SPECIES[s]})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Discovered" hint="the year born; optional" error={y === null ? `Between ${FIRST_YEAR} and ${LAST_YEAR}.` : null} htmlFor="make-dinosaur-year">
          <input id="make-dinosaur-year" value={year} inputMode="numeric" maxLength={4} placeholder={String(ex.y)} onChange={(ev) => setYear(ev.target.value)} className={INPUT} />
        </Field>
        <Field label="Height, cm" hint="optional" error={hOk ? null : `${HEIGHT_MIN} to ${HEIGHT_MAX}.`} htmlFor="make-dinosaur-height">
          <input id="make-dinosaur-height" value={height} inputMode="numeric" maxLength={3} placeholder={String(ex.h)} onChange={(ev) => setHeight(ev.target.value)} className={INPUT} />
        </Field>
      </div>
      <TextField id="make-dinosaur-diet" label="Diet" hint="optional" state={diet} max={DIET_MAX} placeholder={ex.d} suggestions={DIETS} />
    </>
  );
}
