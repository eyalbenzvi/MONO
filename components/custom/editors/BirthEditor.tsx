"use client";

import { useEffect, useRef, useState } from "react";
import { CityField } from "@/components/custom/CityField";
import { loadCities, type Places } from "@/lib/custom/data";
import type { City, CustomSpec } from "@/lib/custom/spec";
import { parseDate, parseTime } from "@/lib/custom/specKit";
import { BABY_NAME_MAX, BABY_NAME_MIN, HELLOS, LENGTH, PRODUCT, WEIGHT, type Hello } from "@/lib/custom/specs/birth";
import { Field, useLexicon } from "./Field";
import { Segmented, Switch } from "./Segmented";
import { TextField, useText } from "./TextField";
import { INPUT, type EditorProps } from "./types";

const HELLO_NAMES: Record<Hello, string> = { girl: "It’s a girl", boy: "It’s a boy", hello: "Hello, world" };

/** A number typed with up to one decimal, in the unit shown: its value scaled to an integer, undefined when empty, null when it isn't one. */
const scaled = (s: string, by: number): number | null | undefined => {
  const t = s.trim().replace(",", ".");
  if (!t) return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Math.round(Number(t) * by) : null;
};

/** Your Birth Announcement: the greeting, the name, the day and time, the weight and length (metric or imperial), the city, the moon. */
export default function BirthEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "birth" ? arrival.p : null;
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
  const [hello, setHello] = useState<Hello>(a?.h ?? "girl");
  const name = useText(a?.n ?? "", BABY_NAME_MAX, lex, { required: "Type the name", touched });
  const [date, setDate] = useState(a?.d ?? "");
  const [time, setTime] = useState(a?.t ?? "");
  const [imperial, setImperial] = useState(a?.u === "i");
  // Metric: kilograms and centimetres as typed; imperial: pounds, ounces and inches.
  const [kg, setKg] = useState(a?.wt !== undefined && a.u !== "i" ? String(a.wt / 1000) : "");
  const [lb, setLb] = useState(a?.wt !== undefined && a.u === "i" ? String(Math.floor(a.wt / 16)) : "");
  const [oz, setOz] = useState(a?.wt !== undefined && a.u === "i" ? String(a.wt % 16) : "");
  const [len, setLen] = useState(a?.ln !== undefined ? String(a.ln / 10) : "");
  const [cityId, setCityId] = useState<number | null>(a?.c ?? null);
  const [moon, setMoon] = useState(a ? a.mo === 1 : true);
  const city: City | undefined = cityId && places ? places.byId(cityId) : undefined;

  const sys = imperial ? "imperial" : "metric";
  // Pounds and ounces are whole (7 lb 8 oz, never 7.5 lb rounded to 8).
  const whole = (v: string) => (/^\s*\d*\s*$/.test(v) ? scaled(v, 1) : null);
  const pounds = whole(lb), ounces = whole(oz);
  const wt = imperial ? (pounds === undefined && ounces === undefined ? undefined : pounds === null || ounces === null ? null : (pounds ?? 0) * 16 + (ounces ?? 0)) : scaled(kg, 1000);
  const ln = scaled(len, 10);
  const wtOk = wt === undefined || (wt !== null && wt >= WEIGHT[sys][0] && wt <= WEIGHT[sys][1] && (!imperial || (ounces ?? 0) < 16));
  const lnOk = ln === undefined || (ln !== null && ln >= LENGTH[sys][0] && ln <= LENGTH[sys][1]);
  const shortName = name.value && name.value.length < BABY_NAME_MIN ? `At least ${BABY_NAME_MIN} letters` : null;
  const dateOk = !!parseDate(date);
  const timeOk = !time || !!parseTime(time);
  const ok = !!lex && !!name.value && !shortName && dateOk && timeOk && wtOk && lnOk;
  const spec: CustomSpec | null = ok
    ? {
        t: "birth",
        v: 1,
        p: { h: hello, n: name.value!, d: date, ...(time ? { t: time } : {}), ...(imperial ? { u: "i" as const } : {}), ...(wt ? { wt } : {}), ...(ln ? { ln } : {}), ...(city ? { c: city.id } : {}), ...(moon ? { mo: 1 as const } : {}) },
      }
    : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: city ? { city } : {} });
  }, [key, city]);

  const w = WEIGHT[sys], l = LENGTH[sys];
  const weightError = wtOk ? null : imperial ? `Between ${Math.floor(w[0] / 16)} lb ${w[0] % 16} oz and ${Math.floor(w[1] / 16)} lb ${w[1] % 16} oz` : `Between ${w[0] / 1000} and ${w[1] / 1000} kg`;
  const lengthError = lnOk ? null : `Between ${l[0] / 10} and ${l[1] / 10} ${imperial ? "in" : "cm"}`;

  return (
    <>
      <Segmented label="Across the top" options={HELLOS} value={hello} onChange={setHello} format={(h) => HELLO_NAMES[h]} />
      <TextField id="make-birth-name" label="Name" state={{ ...name, error: name.error ?? shortName }} max={BABY_NAME_MAX} placeholder={ex.n} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Born" error={!dateOk && (touched || date) ? "A day between 1900 and 2100" : null} htmlFor="make-birth-date">
          <input id="make-birth-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </Field>
        <Field label="At" hint="optional" error={timeOk ? null : "A time as 04:12"} htmlFor="make-birth-time">
          <input id="make-birth-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Switch label="Pounds, ounces and inches" checked={imperial} onChange={setImperial} />
      <div className="grid grid-cols-2 gap-3">
        {imperial ? (
          <Field label="Weight" hint="lb, oz" error={weightError} htmlFor="make-birth-lb">
            <div className="grid grid-cols-2 gap-2">
              <input id="make-birth-lb" value={lb} inputMode="numeric" maxLength={2} placeholder="7" aria-label="Pounds" onChange={(e) => setLb(e.target.value)} className={INPUT} />
              <input id="make-birth-oz" value={oz} inputMode="numeric" maxLength={2} placeholder="8" aria-label="Ounces" onChange={(e) => setOz(e.target.value)} className={INPUT} />
            </div>
          </Field>
        ) : (
          <Field label="Weight" hint="kg, optional" error={weightError} htmlFor="make-birth-kg">
            <input id="make-birth-kg" value={kg} inputMode="decimal" maxLength={5} placeholder="3.4" onChange={(e) => setKg(e.target.value)} className={INPUT} />
          </Field>
        )}
        <Field label="Length" hint={imperial ? "in, optional" : "cm, optional"} error={lengthError} htmlFor="make-birth-length">
          <input id="make-birth-length" value={len} inputMode="decimal" maxLength={5} placeholder={imperial ? "20" : "51"} onChange={(e) => setLen(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <CityField places={places} value={city} onChange={(c) => setCityId(c ? c.id : null)} error="" onBlur={() => {}} label="City (optional)" />
      <Switch label="That night’s moon" checked={moon} onChange={setMoon} />
    </>
  );
}
