"use client";

import { useEffect, useRef, useState } from "react";
import { loadCities, type Places } from "@/lib/custom/data";
import type { CustomSpec } from "@/lib/custom/spec";
import { packPlaces, unpackPlaces } from "@/lib/custom/specKit";
import { PRODUCT, TOUR_MAX, TOUR_MIN, TOUR_NAME_MAX, TOUR_TITLES, TOUR_TITLE_MAX } from "@/lib/custom/specs/tour";
import { useLexicon } from "./Field";
import { PlacesField, draftsOf, rowsOf, type PlaceDraft } from "./PlacesField";
import { TextField, allOk, noProblem, useText } from "./TextField";
import { orExample, previewOf, usePreviewKey } from "./useReportSpec";
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
  const name = useText(a?.n ?? "", TOUR_NAME_MAX, lex, { required: "Add whose tour it is.", touched });
  const title = useText(a?.t ?? TOUR_TITLES[0], TOUR_TITLE_MAX, lex, { required: "Add the tour.", touched });
  const [drafts, setDrafts] = useState<PlaceDraft[]>(a ? draftsOf(unpackPlaces(a.x, { min: TOUR_MIN, max: TOUR_MAX }) ?? []) : []);
  const rows = rowsOf(drafts);
  const few = !rows || rows.length < TOUR_MIN;
  const ok = allOk(lex, name, title) && !!name.value && !!title.value && !few;
  const spec: CustomSpec | null = ok ? { t: "tour", v: 1, p: { n: name.value!, t: title.value!, x: packPlaces(rows!) } } : null;

  // Anything not yet given: the example's (fewer than four dates: the example's after them, to four).
  const exRows = unpackPlaces(ex.x, { min: TOUR_MIN, max: TOUR_MAX }) ?? [];
  const px = rows && [...rows, ...exRows.filter((e) => !rows.some((r) => r.c === e.c))].slice(0, Math.max(TOUR_MIN, rows.length));
  const preview: CustomSpec | null = !spec && !!lex && noProblem(name, title) && !!px ? { t: "tour", v: 1, p: { n: orExample(name.value, ex.n)!, t: orExample(title.value, ex.t)!, x: packPlaces(px) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  const previewKey = usePreviewKey(spec, preview);
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: { places: places?.list }, ...previewOf(previewKey) });
  }, [key, previewKey, places]);

  return (
    <>
      <TextField id="make-tour-name" label="Whose tour" state={name} max={TOUR_NAME_MAX} placeholder={ex.n} />
      <TextField id="make-tour-title" label="The tour" hint="ours, or yours" state={title} max={TOUR_TITLE_MAX} suggestions={TOUR_TITLES} />
      <PlacesField places={places} value={drafts} onChange={setDrafts} max={TOUR_MAX} label="The dates" error={touched && drafts.length < TOUR_MIN ? `At least ${TOUR_MIN} dates.` : !rows ? "Between 1900 and 2100." : null} />
    </>
  );
}
