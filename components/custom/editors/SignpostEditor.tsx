"use client";

import { useEffect, useRef, useState } from "react";
import { CityField } from "@/components/custom/CityField";
import { loadCities, type Places } from "@/lib/custom/data";
import type { City, CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR, packPlaces, unpackPlaces } from "@/lib/custom/specKit";
import { SIGNPOST_MAX } from "@/lib/custom/specs/signpost";
import { Field } from "./Field";
import { PlacesField, draftsOf, rowsOf, type PlaceDraft } from "./PlacesField";
import { yearOf } from "./RowsField";
import { Segmented, Switch } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

/** Your Signpost: home and up to six places; or, since, two cities and a year. Kilometres or miles. */
export default function SignpostEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "signpost" ? arrival.p : null;
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
  const [mode, setMode] = useState<"post" | "since">(a?.k === "since" ? "since" : "post");
  const [homeId, setHomeId] = useState<number | null>(a?.h ?? null);
  const [drafts, setDrafts] = useState<PlaceDraft[]>(a && a.k !== "since" ? draftsOf(unpackPlaces(a.x, { min: 1, max: SIGNPOST_MAX, years: false }) ?? []) : []);
  const [otherId, setOtherId] = useState<number | null>(a?.k === "since" ? (unpackPlaces(a.x, { min: 1, max: 1, years: false })?.[0]?.c ?? null) : null);
  const [year, setYear] = useState(a?.y ? String(a.y) : "");
  const [miles, setMiles] = useState(a?.mi === 1);
  const home: City | undefined = homeId && places ? places.byId(homeId) : undefined;
  const other: City | undefined = otherId && places ? places.byId(otherId) : undefined;

  const since = mode === "since";
  const rows = rowsOf(drafts);
  const y = yearOf(year, FIRST_YEAR, LAST_YEAR);
  const clash = since ? !!home && !!other && home.id === other.id : !!rows && (rows.some((r) => r.c === homeId) || new Set(rows.map((r) => r.c)).size !== rows.length);
  let spec: CustomSpec | null = null;
  if (home && !clash) {
    if (since && other && y) spec = { t: "signpost", v: 1, p: { k: "since", h: home.id, x: packPlaces([{ c: other.id }]), y, ...(miles ? { mi: 1 as const } : {}) } };
    if (!since && rows && rows.length >= 1) spec = { t: "signpost", v: 1, p: { h: home.id, x: packPlaces(rows.map((r) => ({ c: r.c }))), ...(miles ? { mi: 1 as const } : {}) } };
  }

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: { places: places?.list } });
  }, [key, places]);

  return (
    <>
      <Segmented label="Make" options={["post", "since"] as const} value={mode} onChange={setMode} format={(m) => (m === "since" ? "Two places, since" : "Home and places")} />
      <CityField places={places} value={home} onChange={(c) => setHomeId(c ? c.id : null)} error={touched && !home ? "Choose a city" : ""} onBlur={() => {}} label={since ? "One place" : "Home"} />
      {since ? (
        <>
          <CityField id="custom-place-other" places={places} value={other} onChange={(c) => setOtherId(c ? c.id : null)} error={touched && !other ? "Choose a city" : clash ? "Two different places" : ""} onBlur={() => {}} label="The other place" />
          <Field label="Since" error={y === null || (touched && !y) ? `A year between ${FIRST_YEAR} and ${LAST_YEAR}` : null} htmlFor="make-signpost-year">
            <input id="make-signpost-year" value={year} inputMode="numeric" maxLength={4} placeholder="2016" onChange={(e) => setYear(e.target.value)} className={INPUT} />
          </Field>
        </>
      ) : (
        <PlacesField places={places} value={drafts} onChange={setDrafts} max={SIGNPOST_MAX} label="Places" years={false} error={clash ? "Each place once, and not home" : touched && !drafts.length ? "Add a place" : null} />
      )}
      <Switch label="Miles" checked={miles} onChange={setMiles} />
    </>
  );
}
