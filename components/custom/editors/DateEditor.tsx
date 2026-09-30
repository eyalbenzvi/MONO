"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CityField, cityLabel } from "@/components/custom/CityField";
import { loadCities, loadSky, type Places } from "@/lib/custom/data";
import { FALLBACK_CITY } from "@/lib/custom/products";
import { FIRST_YEAR, LAST_YEAR, PLANETS_LAST_YEAR, parseDate, parseTime, type City, type CustomSpec } from "@/lib/custom/spec";
import type { SkyData } from "@/lib/custom/templates/sky";
import { Field } from "./Field";
import { INPUT, type EditorProps } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The visitor's place, from their time zone: its biggest city (London when the zone has none in the list). */
export function autoCity(places: Places): City | undefined {
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* no zone: the fallback */
  }
  const inZone = places.list.filter((c) => c.tz === zone).sort((a, b) => b.pop - a.pop)[0];
  return inZone ?? places.byId(FALLBACK_CITY);
}

/**
 * The four dated products' fields: your day (a night, a day or a year), for
 * a sky the time and the place (from your time zone, with a small "Change"),
 * north or south for the moons. The words are the caption's title (CaptionField, cap[0]).
 */
export default function DateEditor({ made, arrival, touched: tried, onChange }: EditorProps) {
  const t = made.template;
  // Data: the place list (a sky's place; the hemisphere's default elsewhere) and the sky.
  const [places, setPlaces] = useState<Places | null>(null);
  const [sky, setSky] = useState<SkyData | null>(null);
  useEffect(() => {
    let live = true;
    loadCities()
      .then((p) => live && setPlaces(p))
      .catch(() => {});
    if (t === "sky")
      loadSky()
        .then((s) => live && setSky(s))
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [t]);

  // Fields: from the address when it carries a print for this product, else today and your place.
  const a = arrival;
  const [date, setDate] = useState(a && (a.t === "sky" || a.t === "night" || a.t === "planets") ? a.p.d : today);
  const [time, setTime] = useState(a?.t === "sky" ? (a.p.t ?? "") : "");
  const [year, setYear] = useState(a?.t === "moon" ? String(a.p.y) : String(new Date().getFullYear()));
  const [cityId, setCityId] = useState<number | null>(a?.t === "sky" ? a.p.c : null);
  const [south, setSouth] = useState<boolean | null>(a && (a.t === "moon" || a.t === "night") ? a.p.s === 1 : null);
  const [changingPlace, setChangingPlace] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const here = useMemo(() => (places ? autoCity(places) : undefined), [places]);
  // A link's city that isn't in the list is dropped (the page falls back to your place).
  const linked = cityId && places ? places.byId(cityId) : undefined;
  const city = linked ?? here;
  const southNow = south ?? (here ? here.lat < 0 : false);

  const lastYear = t === "planets" ? PLANETS_LAST_YEAR : LAST_YEAR;
  const dateOk = !!parseDate(date) && Number(date.slice(0, 4)) <= lastYear;
  const spec: CustomSpec | null = useMemo(() => {
    const s = southNow ? { s: 1 as const } : {};
    if (t === "moon") {
      const y = Number(year);
      return /^\d{4}$/.test(year) && y >= FIRST_YEAR && y <= LAST_YEAR ? { t: "moon", v: 1, p: { y, ...s } } : null;
    }
    if (!dateOk) return null;
    if (t === "night") return { t: "night", v: 1, p: { d: date, ...s } };
    if (t === "planets") return { t: "planets", v: 1, p: { d: date } };
    if (!city || (time && !parseTime(time))) return null;
    return { t: "sky", v: 1, p: { c: city.id, d: date, ...(time ? { t: time } : {}) } };
  }, [southNow, t, year, dateOk, date, city, time]);

  const report = useRef(onChange);
  report.current = onChange;
  useEffect(() => {
    report.current({ spec: t === "sky" && !sky ? null : spec, data: { sky: sky ?? undefined, city } });
  }, [spec, sky, city, t]);

  const all = tried || false;
  const errors = {
    date: (touched.date || all) && !dateOk ? `Between ${FIRST_YEAR} and ${lastYear}.` : "",
    time: (touched.time || all) && time && !parseTime(time) ? "Pick a time, or leave it empty." : "",
    year: (touched.year || all) && t === "moon" && !spec ? `Between ${FIRST_YEAR} and ${LAST_YEAR}.` : "",
  };

  return (
    <>
      {t === "moon" ? (
        <Field label="Year" error={errors.year} htmlFor="make-year">
          <input
            id="make-year"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onBlur={() => setTouched((x) => ({ ...x, year: true }))}
            aria-invalid={!!errors.year}
            className={`${INPUT} font-mono`}
          />
        </Field>
      ) : (
        <div className={t === "sky" ? "grid grid-cols-[1fr_8rem] gap-3" : ""}>
          <Field label={t === "planets" ? "Day" : "Night"} error={errors.date} htmlFor="make-date">
            <input
              id="make-date"
              type="date"
              min={`${FIRST_YEAR}-01-01`}
              max={`${lastYear}-12-31`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={() => setTouched((x) => ({ ...x, date: true }))}
              aria-invalid={!!errors.date}
              className={INPUT}
            />
          </Field>
          {t === "sky" && (
            <Field label="Time" hint="optional" error={errors.time} htmlFor="make-time">
              <input id="make-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => setTouched((x) => ({ ...x, time: true }))} aria-invalid={!!errors.time} className={INPUT} />
            </Field>
          )}
        </div>
      )}
      {t === "sky" &&
        (changingPlace ? (
          <CityField
            places={places}
            value={linked}
            onChange={(c) => {
              setCityId(c?.id ?? null);
              if (c) setChangingPlace(false);
            }}
            error=""
            onBlur={() => setTouched((x) => ({ ...x, place: true }))}
          />
        ) : (
          <p className="flex min-h-10 flex-wrap items-center gap-x-2 text-sm text-neutral-400" data-place>
            <span>
              Seen from <span className="text-neutral-200">{city ? cityLabel(city) : "…"}</span>
              {!linked && city ? " (your time zone)" : ""}
            </span>
            <button type="button" onClick={() => setChangingPlace(true)} className="-my-2 h-11 text-neutral-300 underline underline-offset-4 hover:text-white">
              Change
            </button>
          </p>
        ))}
      {(t === "moon" || t === "night") && (
        <label className="flex h-11 cursor-pointer items-center justify-between text-sm text-neutral-300">
          Seen from the south
          <input type="checkbox" role="switch" checked={southNow} onChange={(e) => setSouth(e.target.checked)} className="peer sr-only" />
          <span aria-hidden className="relative h-6 w-10 rounded-full bg-white/15 transition peer-checked:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4 peer-checked:after:bg-black" />
        </label>
      )}
    </>
  );
}
