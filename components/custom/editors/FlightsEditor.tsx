"use client";

import { useEffect, useRef, useState } from "react";
import { loadAirports, type Airport, type Airports } from "@/lib/custom/data";
import type { CustomSpec } from "@/lib/custom/spec";
import { FIRST_YEAR, LAST_YEAR, parseDate } from "@/lib/custom/specKit";
import { BOARD_MAX, GATE, PASSENGER_MAX, PRODUCT, SEAT, type Departure } from "@/lib/custom/specs/flights";
import { AirportField } from "./AirportField";
import { Field, useLexicon } from "./Field";
import { yearOf } from "./RowsField";
import { Segmented } from "./Segmented";
import { TextField, useText } from "./TextField";
import { INPUT, type EditorProps } from "./types";

const LINK = "h-11 px-1 text-xs text-neutral-300 underline underline-offset-4 hover:text-white";

/** Your Flights: a departures board (up to eight airports, each with its year), or a boarding pass (from, to, the day, a seat, a gate). */
export default function FlightsEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "flights" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [airports, setAirports] = useState<Airports | null>(null);
  useEffect(() => {
    let live = true;
    loadAirports()
      .then((x) => live && setAirports(x))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const [mode, setMode] = useState<"board" | "pass">(a?.k ?? "board");
  const name = useText(a?.n ?? "", PASSENGER_MAX, lex, { required: mode === "pass" ? "Add the passenger’s name." : undefined, touched });
  const [rows, setRows] = useState<{ code: string; year: string }[]>(a?.k === "board" ? a.x!.map(([code, y]) => ({ code, year: y ? String(y) : "" })) : []);
  const [adding, setAdding] = useState(0);
  const [from, setFrom] = useState(a?.f ?? "");
  const [to, setTo] = useState(a?.t ?? "");
  const [date, setDate] = useState(a?.d ?? "");
  const [seat, setSeat] = useState(a?.s ?? "");
  const [gate, setGate] = useState(a?.g ?? "");
  const byCode = (c: string): Airport | undefined => (c && airports ? airports.byCode(c) : undefined);

  const years = rows.map((r) => yearOf(r.year, FIRST_YEAR, LAST_YEAR));
  const seatOk = !seat || SEAT.test(seat.toUpperCase());
  const gateOk = !gate || GATE.test(gate.toUpperCase());
  const dateOk = !date || !!parseDate(date);
  let spec: CustomSpec | null = null;
  const nameOk = name.ok && (!name.text.trim() || !!lex);
  if (mode === "board" && rows.length && years.every((y) => y !== null) && nameOk) {
    const x: Departure[] = rows.map((r, i) => (years[i] ? [r.code, years[i]!] : [r.code]));
    spec = { t: "flights", v: 1, p: { k: "board", ...(name.value ? { n: name.value } : {}), x } };
  }
  if (mode === "pass" && name.value && nameOk && from && to && from !== to && dateOk && seatOk && gateOk)
    spec = { t: "flights", v: 1, p: { k: "pass", n: name.value, f: from, t: to, ...(date ? { d: date } : {}), ...(seat ? { s: seat.toUpperCase() } : {}), ...(gate ? { g: gate.toUpperCase() } : {}) } };

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null, data: airports ? { airports } : {} });
  }, [key, airports]);

  const move = (i: number, by: number) => setRows((rs) => {
    const next = [...rs];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    return next;
  });

  return (
    <>
      <Segmented label="Make" options={["board", "pass"] as const} value={mode} onChange={setMode} format={(m) => (m === "pass" ? "Boarding pass" : "Departures board")} />
      <TextField id="make-flights-name" label={mode === "pass" ? "Passenger" : "Whose board"} hint={mode === "pass" ? undefined : "optional"} state={name} max={PASSENGER_MAX} placeholder={mode === "pass" ? "Noa Cohen" : ex.n} />
      {mode === "board" ? (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={`${r.code}-${i}`} className="grid grid-cols-[1fr_5.5rem_auto] items-end gap-2">
              <p className="flex h-11 items-center gap-2 truncate text-sm text-white">
                <span className="font-mono font-medium">{r.code}</span>
                <span className="truncate text-neutral-400">{byCode(r.code)?.city ?? ""}</span>
              </p>
              <Field label={`Year ${i + 1}`} hint="optional" error={years[i] === null ? "1900 to 2100" : null} htmlFor={`make-flights-y${i}`}>
                <input id={`make-flights-y${i}`} value={r.year} inputMode="numeric" maxLength={4} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} className={INPUT} />
              </Field>
              <div className="flex">
                {i > 0 && (
                  <button type="button" className={LINK} onClick={() => move(i, -1)} aria-label={`Move ${r.code} up`}>
                    Up
                  </button>
                )}
                <button type="button" className={LINK} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${r.code}`}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          {rows.length < BOARD_MAX && (
            <AirportField key={adding} id="make-flights-add" label="Add an airport" airports={airports} value={undefined} onChange={(x) => x && (setRows((rs) => [...rs, { code: x.iata, year: "" }]), setAdding((n) => n + 1))} error={touched && !rows.length ? "Add an airport." : null} />
          )}
        </div>
      ) : (
        <>
          <AirportField id="make-flights-from" label="From" airports={airports} value={byCode(from)} onChange={(x) => setFrom(x?.iata ?? "")} error={touched && !from ? "Choose an airport." : null} />
          <AirportField id="make-flights-to" label="To" airports={airports} value={byCode(to)} onChange={(x) => setTo(x?.iata ?? "")} error={touched && !to ? "Choose an airport." : from && from === to ? "Somewhere else." : null} />
          <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
            <Field label="Date" hint="optional" error={dateOk ? null : "Between 1900 and 2100."} htmlFor="make-flights-date">
              <input id="make-flights-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Seat" hint="opt." error={seatOk ? null : "As 14A."} htmlFor="make-flights-seat">
              <input id="make-flights-seat" value={seat} maxLength={3} placeholder="14A" onChange={(e) => setSeat(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Gate" hint="opt." error={gateOk ? null : "As B22."} htmlFor="make-flights-gate">
              <input id="make-flights-gate" value={gate} maxLength={4} placeholder="B22" onChange={(e) => setGate(e.target.value)} className={INPUT} />
            </Field>
          </div>
        </>
      )}
    </>
  );
}
