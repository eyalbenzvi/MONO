"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CityField } from "@/components/custom/CityField";
import { loadCities, type Places } from "@/lib/custom/data";
import { FIRST_YEAR, LAST_YEAR, coords, parseDate, type City, type CustomSpec } from "@/lib/custom/spec";
import { autoCity } from "./DateEditor";
import { Field, WordsField, useWords } from "./Field";
import { Segmented } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

/** Two decimals of a degree: about a kilometre, never finer. */
const round2 = (v: number) => Math.round(v * 100) / 100;
/** A coordinate as typed: a decimal ("32.0853"), or with its hemisphere ("32.08 N", "34.78W"). */
function parseCoord(raw: string, max: number, pos: string, neg: string): number | null {
  const m = new RegExp(`^\\s*(-?\\d{1,3}(?:[.,]\\d+)?)\\s*°?\\s*([${pos}${neg}${pos.toLowerCase()}${neg.toLowerCase()}])?\\s*$`).exec(raw);
  if (!m) return null;
  let v = Number(m[1].replace(",", "."));
  if (m[2] && m[2].toUpperCase() === neg) v = -Math.abs(v);
  return Math.abs(v) <= max ? round2(v) : null;
}

/**
 * Your Place: a city (from your time zone, searchable) or the exact place
 * (latitude and longitude, typed or from this device's location, rounded to
 * about a kilometre), the day it happened (optional), your words.
 */
export default function PlaceEditor({ made, arrival, onChange }: EditorProps) {
  const a = arrival?.t === "place" ? arrival.p : null;
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
  const [mode, setMode] = useState<"city" | "exact">(a && a.c === undefined ? "exact" : "city");
  const [cityId, setCityId] = useState<number | null>(a?.c ?? null);
  const [lat, setLat] = useState(a ? String(a.la) : "");
  const [lon, setLon] = useState(a ? String(a.lo) : "");
  const [date, setDate] = useState(a?.d ?? "");
  const [locating, setLocating] = useState<"" | "busy" | "off">("");
  const words = useWords(a?.w ?? "");

  const here = useMemo(() => (places ? autoCity(places) : undefined), [places]);
  const city: City | undefined = (cityId && places ? places.byId(cityId) : undefined) ?? here;
  const la = parseCoord(lat, 90, "N", "S"), lo = parseCoord(lon, 180, "E", "W");
  const dateOk = !date || (!!parseDate(date) && Number(date.slice(0, 4)) >= FIRST_YEAR && Number(date.slice(0, 4)) <= LAST_YEAR);
  const w = words.value;
  const spec: CustomSpec | null = useMemo(() => {
    if (!places || w === null || !dateOk) return null;
    const rest = { ...(date ? { d: date } : {}), ...(w ? { w } : {}) };
    if (mode === "city") return city ? { t: "place", v: 1, p: { la: round2(city.lat), lo: round2(city.lon), c: city.id, ...rest } } : null;
    return la !== null && lo !== null ? { t: "place", v: 1, p: { la, lo, ...rest } } : null;
  }, [places, w, dateOk, date, mode, city, la, lo]);

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: { places: places?.list } });
  }, [key, places]);

  const locate = () => {
    if (!navigator.geolocation) return setLocating("off");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(round2(pos.coords.latitude)));
        setLon(String(round2(pos.coords.longitude)));
        setLocating("");
      },
      () => setLocating("off"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  return (
    <>
      <WordsField words={words} hint={made.wordsHint ?? ""} />
      <Segmented label="Where" options={["city", "exact"] as const} value={mode} onChange={setMode} format={(x) => (x === "city" ? "A city" : "Exact place")} />
      {mode === "city" ? (
        <CityField places={places} value={city} onChange={(c) => c && setCityId(c.id)} error="" onBlur={() => {}} />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" hint="N or S" error={lat && la === null ? "−90 to 90" : null} htmlFor="make-lat">
              <input id="make-lat" value={lat} inputMode="decimal" autoComplete="off" placeholder="32.08" onChange={(e) => setLat(e.target.value)} aria-invalid={!!lat && la === null} className={`${INPUT} font-mono`} />
            </Field>
            <Field label="Longitude" hint="E or W" error={lon && lo === null ? "−180 to 180" : null} htmlFor="make-lon">
              <input id="make-lon" value={lon} inputMode="decimal" autoComplete="off" placeholder="34.78" onChange={(e) => setLon(e.target.value)} aria-invalid={!!lon && lo === null} className={`${INPUT} font-mono`} />
            </Field>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-400">
            <button type="button" onClick={locate} className="h-10 text-neutral-300 underline underline-offset-4 hover:text-white" data-locate>
              {locating === "busy" ? "Finding…" : "Where I am now"}
            </button>
            <span>{locating === "off" ? "Location is off. Type the place instead." : la !== null && lo !== null ? coords(la, lo) : "Rounded to about a kilometre."}</span>
          </p>
        </div>
      )}
      <Field label="The day" hint="optional" error={dateOk ? null : `Pick a day between ${FIRST_YEAR} and ${LAST_YEAR}`} htmlFor="make-date">
        <input id="make-date" type="date" min={`${FIRST_YEAR}-01-01`} max={`${LAST_YEAR}-12-31`} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!dateOk} className={INPUT} />
      </Field>
    </>
  );
}
