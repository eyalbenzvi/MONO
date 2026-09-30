"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadCountries, type Countries } from "@/lib/custom/data";
import type { CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR } from "@/lib/custom/specKit";
import { COUNTRIES_NAME_MAX, COUNTRY_CODES, NOT_COUNTED, OF, PRODUCT, counted, packCountries, unpackCountries } from "@/lib/custom/specs/countries";
import { Field, useLexicon } from "./Field";
import { yearOf } from "./RowsField";
import { TextField, useText } from "./TextField";
import { INPUT, type EditorProps } from "./types";

/** Letters without their accents, lower case: how the filter matches ("cote" finds Côte d'Ivoire). */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Your Countries: the countries you've been to (a list to tick, with a filter), your name, since when. */
export default function CountriesEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "countries" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [countries, setCountries] = useState<Countries | null>(null);
  useEffect(() => {
    let live = true;
    loadCountries()
      .then((c) => live && setCountries(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(a ? (unpackCountries(a.x) ?? []) : []));
  const [filter, setFilter] = useState("");
  const name = useText(a?.n ?? "", COUNTRIES_NAME_MAX, lex);
  const [since, setSince] = useState(a?.y ? String(a.y) : "");
  const y = yearOf(since, FIRST_YEAR, LAST_YEAR);
  const shown = useMemo(() => {
    const all = (countries?.list ?? []).filter((c) => (COUNTRY_CODES as readonly string[]).includes(c.a3));
    const q = fold(filter.trim());
    return [...all].sort((m, n) => (m.name < n.name ? -1 : 1)).filter((c) => !q || fold(c.name).includes(q));
  }, [countries, filter]);
  const ok = picked.size > 0 && name.ok && (!name.text.trim() || !!lex) && y !== null;
  const spec: CustomSpec | null = ok ? { t: "countries", v: 1, p: { x: packCountries([...picked]), ...(name.value ? { n: name.value } : {}), ...(y ? { y } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: countries ? { countries } : {} });
  }, [key, countries]);

  const toggle = (a3: string) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(a3)) next.delete(a3);
    else next.add(a3);
    return next;
  });

  return (
    <>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <TextField id="make-countries-name" label="Whose" hint="optional" state={name} max={COUNTRIES_NAME_MAX} placeholder={ex.n} />
        <Field label="Since" hint="optional" error={y === null ? `A year between ${FIRST_YEAR} and ${LAST_YEAR}` : null} htmlFor="make-countries-since">
          <input id="make-countries-since" value={since} inputMode="numeric" maxLength={4} placeholder={String(ex.y)} onChange={(e) => setSince(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label="Countries" hint={`${counted([...picked])} of ${OF}${picked.size ? "" : " · tick the ones you've been to"}`} error={touched && !picked.size ? "Tick a country" : null} htmlFor="make-countries-filter">
        <input id="make-countries-filter" type="search" value={filter} placeholder="Find a country" autoComplete="off" onChange={(e) => setFilter(e.target.value)} className={INPUT} />
      </Field>
      <ul className="max-h-72 overflow-y-auto rounded-xl ring-1 ring-white/10" aria-label="Countries">
        {!countries && <li className="px-3 py-2 text-sm text-neutral-400">Loading the map…</li>}
        {shown.map((c) => (
          <li key={c.a3}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-neutral-200 hover:bg-white/5">
              <input type="checkbox" checked={picked.has(c.a3)} onChange={() => toggle(c.a3)} className="h-4 w-4 accent-white" />
              <span className="flex-1">{c.name}</span>
              {NOT_COUNTED.includes(c.a3) && <span className="text-xs text-neutral-500">drawn, not counted</span>}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
