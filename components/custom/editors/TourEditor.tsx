"use client";

import { useEffect, useRef, useState } from "react";
import { loadCities, type Places } from "@/lib/custom/data";
import type { CustomSpec } from "@/lib/custom/spec";
import { packPlaces, unpackPlaces } from "@/lib/custom/specKit";
import { PRODUCT, TOUR_MAX, TOUR_MIN, TOUR_NAME_MAX, TOUR_TITLES, TOUR_TITLE_MAX } from "@/lib/custom/specs/tour";
import { useLexicon } from "./Field";
import { PlacesField, draftsOf, rowsOf, type PlaceDraft } from "./PlacesField";
import { TextField, allOk, useText } from "./TextField";
import type { EditorProps } from "./types";

/** Your World Tour: whose tour, which tour (ours or yours), and the dates: 4 to 24 places, each with its year. */
export default function TourEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "tour" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [places, setPlaces] = useState<Places | null>(null);
  useEffect(() => {
    let live = true;
    loadCities()
      .then((p) => live && setPlaces(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const name = useText(a?.n ?? "", TOUR_NAME_MAX, lex, { required: "Whose tour?", touched });
  const title = useText(a?.t ?? TOUR_TITLES[0], TOUR_TITLE_MAX, lex, { required: "Name the tour", touched });
  const [drafts, setDrafts] = useState<PlaceDraft[]>(a ? draftsOf(unpackPlaces(a.x, { min: TOUR_MIN, max: TOUR_MAX }) ?? []) : []);
  const rows = rowsOf(drafts);
  const few = !rows || rows.length < TOUR_MIN;
  const ok = allOk(lex, name, title) && !!name.value && !!title.value && !few;
  const spec: CustomSpec | null = ok ? { t: "tour", v: 1, p: { n: name.value!, t: title.value!, x: packPlaces(rows!) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: { places: places?.list } });
  }, [key, places]);

  return (
    <>
      <TextField id="make-tour-name" label="Whose tour" state={name} max={TOUR_NAME_MAX} placeholder={ex.n} />
      <TextField id="make-tour-title" label="The tour" hint="ours, or yours" state={title} max={TOUR_TITLE_MAX} suggestions={TOUR_TITLES} />
      <PlacesField places={places} value={drafts} onChange={setDrafts} max={TOUR_MAX} label="The dates" error={touched && drafts.length < TOUR_MIN ? `At least ${TOUR_MIN} dates` : !rows ? "A year between 1900 and 2100" : null} />
    </>
  );
}
