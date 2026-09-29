"use client";

import { useEffect, useRef, useState } from "react";
import { routeFromDrawing, routeFromTrack, type TrackPoint } from "@/lib/custom/draw/route";
import { FIRST_YEAR, LAST_YEAR, parseDate, type CustomSpec } from "@/lib/custom/spec";
import { ROUTE_MAX_KM, routePoints, type Params } from "@/lib/custom/specs/route";
import { Field, WordsField, useWords } from "./Field";
import { Segmented, Switch } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

/**
 * A GPX file's track, read here with the browser's own XML parser: the
 * track points (or, failing those, the route points), their heights, and
 * the day of the first timestamp. The file goes no further than this.
 */
function readGpx(xml: string): { track: TrackPoint[]; day: string | null } | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return null;
  let nodes = Array.from(doc.getElementsByTagName("trkpt"));
  if (!nodes.length) nodes = Array.from(doc.getElementsByTagName("rtept"));
  const track = nodes.map((n) => {
    const ele = n.getElementsByTagName("ele")[0]?.textContent;
    return { lat: Number(n.getAttribute("lat")), lon: Number(n.getAttribute("lon")), ...(ele != null && ele.trim() !== "" && Number.isFinite(Number(ele)) ? { ele: Number(ele) } : {}) };
  });
  const time = doc.getElementsByTagName("time")[0]?.textContent?.trim() ?? "";
  const day = /^\d{4}-\d{2}-\d{2}/.test(time) && parseDate(time.slice(0, 10)) ? time.slice(0, 10) : null;
  return { track, day };
}

/** The blank grid under the pad (eight squares a side). */
const GRID = Array.from({ length: 7 }, (_, i) => `M${(i + 1) * 125} 0V1000M0 ${(i + 1) * 125}H1000`).join("");
const KM = /^\d{1,4}([.,]\d)?$/;

/**
 * Your Route: a GPX file (read on this device; only the route's shape goes
 * in the print, and the file isn't kept), or a line drawn on a blank grid;
 * whether the first and last 200 m are hidden (on unless turned off), the
 * title, the day, the distance.
 */
export default function RouteEditor({ made, arrival, onChange }: EditorProps) {
  const a = arrival?.t === "route" ? arrival.p : null;
  const start: Params = a ?? made.example.p as Params;
  const [source, setSource] = useState<"file" | "draw">(a && a.m === undefined ? "draw" : "file");
  // The route as the spec has it (from the link, the file or the pad); the file's track stays in memory only.
  const [shape, setShape] = useState<Pick<Params, "r" | "m" | "e"> | null>({ r: start.r, ...(start.m !== undefined ? { m: start.m } : {}), ...(start.e !== undefined ? { e: start.e } : {}) });
  const [track, setTrack] = useState<TrackPoint[] | null>(null);
  const [hide, setHide] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [date, setDate] = useState(start.d ?? "");
  const [dist, setDist] = useState(start.k !== undefined ? String(start.k) : "");
  const words = useWords(start.w ?? "");
  const pad = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<[number, number][] | null>(null);

  // A new file, or the switch: the route made again from the track in memory.
  useEffect(() => {
    if (!track) return;
    const got = routeFromTrack(track, hide);
    if (typeof got === "string") {
      setFileError(got);
      setShape(null);
      return;
    }
    setFileError(null);
    setShape({ r: got.r, m: got.m, ...(got.e ? { e: got.e } : {}) });
  }, [track, hide]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    if (file.size > 30 << 20) return setFileError("That file is too big. Try one under 30 MB."), setTrack(null), setShape(null);
    const got = readGpx(await file.text());
    if (!got || got.track.length < 2) return setFileError("That doesn't look like a GPX file with a track."), setTrack(null), setShape(null);
    setTrack(got.track);
    const km = routeFromTrack(got.track, false);
    if (typeof km !== "string") setDist(String(km.k));
    if (got.day) setDate(got.day);
  };

  const k = dist.trim() === "" ? undefined : KM.test(dist.trim()) && Number(dist.trim().replace(",", ".")) >= 0.1 && Number(dist.trim().replace(",", ".")) <= ROUTE_MAX_KM ? Number(dist.trim().replace(",", ".")) : null;
  const dateOk = !date || (!!parseDate(date) && Number(date.slice(0, 4)) >= FIRST_YEAR && Number(date.slice(0, 4)) <= LAST_YEAR);
  const w = words.value;
  const spec: CustomSpec | null =
    shape && k !== null && dateOk && w !== null
      ? { t: "route", v: 1, p: { r: shape.r, ...(shape.m !== undefined ? { m: shape.m } : {}), ...(k !== undefined ? { k } : {}), ...(shape.e ? { e: shape.e } : {}), ...(date ? { d: date } : {}), ...(w ? { w } : {}) } }
      : null;
  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  const at = (e: React.PointerEvent): [number, number] => {
    const r = pad.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 1000, ((e.clientY - r.top) / r.height) * 1000];
  };
  // The drawn route as the pad shows it: fitted into the pad the way the print fits it.
  const drawn = source === "draw" && shape && shape.m === undefined ? (routePoints(shape.r) ?? []).map(([x, y]) => [100 + (x / 255) * 800, 100 + (y / 255) * 800] as [number, number]) : [];
  const shown = drawing ?? drawn;

  return (
    <>
      <Segmented
        label="Route"
        options={["file", "draw"] as const}
        value={source}
        onChange={(s) => {
          setSource(s);
          setShape(null);
          setTrack(null);
          setFileError(null);
          setFileName("");
        }}
        format={(x) => (x === "file" ? "A GPX file" : "Draw it")}
      />
      {source === "file" ? (
        <div className="space-y-1">
          <Field label="GPX file" hint="read on this device, never uploaded" error={fileError} htmlFor="make-gpx">
            <input id="make-gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={(e) => onFile(e.target.files?.[0])} className={`${INPUT} pt-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:text-xs file:font-semibold file:text-black`} />
          </Field>
          {fileName && !fileError && <p className="text-xs text-neutral-400">{fileName}: only the route&rsquo;s shape goes in the print.</p>}
          {!track && shape && <p className="text-xs text-neutral-500">Showing {a ? "the route from the link" : "an example route"}. Choose a file to use yours.</p>}
          <Switch label="Hide the first and last 200 m" checked={hide} onChange={setHide} />
        </div>
      ) : (
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs font-medium text-neutral-400">
            <span id="make-route-pad">Draw the route</span>
            <button type="button" onClick={() => setShape(null)} className="h-8 text-neutral-300 underline underline-offset-4 hover:text-white">
              Clear
            </button>
          </div>
          <div
            ref={pad}
            role="img"
            aria-labelledby="make-route-pad"
            className="relative aspect-square w-full touch-none select-none rounded-2xl bg-white/[0.04] ring-1 ring-white/10"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrawing([at(e)]);
            }}
            onPointerMove={(e) => drawing && setDrawing((d) => (d ? [...d, at(e)] : d))}
            onPointerUp={() => {
              if (!drawing) return;
              const r = routeFromDrawing(drawing);
              if (r) setShape({ r });
              setDrawing(null);
            }}
            onPointerCancel={() => setDrawing(null)}
          >
            <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <path d={GRID} fill="none" strokeWidth={2} className="stroke-white/10" />
              {shown.length > 1 && <polyline points={shown.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(" ")} fill="none" stroke="white" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
            {!shape && !drawing && <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">Draw here</p>}
          </div>
        </div>
      )}
      <WordsField words={words} hint={made.wordsHint ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Distance" hint="km, optional" error={k === null ? `0.1 to ${ROUTE_MAX_KM} km` : null} htmlFor="make-route-km">
          <input id="make-route-km" value={dist} inputMode="decimal" maxLength={6} autoComplete="off" placeholder="10.5" onChange={(e) => setDist(e.target.value)} aria-invalid={k === null} className={`${INPUT} font-mono`} />
        </Field>
        <Field label="The day" hint="optional" error={dateOk ? null : `Pick a day between ${FIRST_YEAR} and ${LAST_YEAR}`} htmlFor="make-route-date">
          <input id="make-route-date" type="date" min={`${FIRST_YEAR}-01-01`} max={`${LAST_YEAR}-12-31`} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!dateOk} className={INPUT} />
        </Field>
      </div>
    </>
  );
}
