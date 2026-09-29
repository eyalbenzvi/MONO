"use client";

import { useEffect, useRef, useState } from "react";
import { cleanWords, type CustomSpec } from "@/lib/custom/spec";
import { ISLAND_NAME_MAX, ISLAND_PLACES, ISLAND_PLACE_MAX, ISLAND_REDRAWS, type Params } from "@/lib/custom/specs/island";
import { Field, useLexicon } from "./Field";
import { INPUT, type EditorProps } from "./types";

type Lexicon = NonNullable<ReturnType<typeof useLexicon>>;
/** A printed name as typed: its tidy form, or why it can't print (null while the lexicon loads). */
function nameOf(raw: string, max: number, lex: Lexicon | null): { value: string | null; error: string | null } {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return { value: null, error: null };
  const clean = cleanWords(t, max);
  if (!clean) return { value: null, error: `Up to ${max} letters, numbers and simple punctuation` };
  if (!lex) return { value: null, error: null };
  const refused = lex.wordsProblem(clean);
  return refused ? { value: null, error: refused } : { value: clean, error: null };
}

/** Your Island: the island's name (it grows from it), up to six places named for your people, and "Another island" for a different one from the same name. */
export default function IslandEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "island" ? arrival.p : null;
  const start = a ?? (made.example.p as Params);
  const [name, setName] = useState(start.n);
  const [places, setPlaces] = useState<string[]>(start.x?.length ? start.x : [""]);
  const [redraw, setRedraw] = useState(start.s ?? 0);
  const lex = useLexicon(true);

  const n = nameOf(name, ISLAND_NAME_MAX, lex);
  const nameError = n.error ?? (!name.trim() && touched ? "Name the island" : null);
  const each = places.map((x) => nameOf(x, ISLAND_PLACE_MAX, lex));
  const typed = each.filter((e, i) => places[i].trim() && e.value).map((e) => e.value!);
  const placesOk = lex && each.every((e) => !e.error);
  const spec: CustomSpec | null =
    n.value && placesOk ? { t: "island", v: 1, p: { n: n.value, ...(typed.length ? { x: typed } : {}), ...(redraw ? { s: redraw } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  const link = "h-10 text-sm text-neutral-300 underline underline-offset-4 hover:text-white disabled:opacity-30";
  return (
    <>
      <Field label="The island's name" hint="it grows from the name" error={nameError} htmlFor="make-island">
        <input id="make-island" value={name} maxLength={ISLAND_NAME_MAX + 4} placeholder={made.wordsHint} autoComplete="off" onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} className={INPUT} />
      </Field>
      <div className="space-y-2">
        {places.map((x, i) => (
          <Field key={i} label={`Place ${i + 1}`} hint={i === 0 ? `up to ${ISLAND_PLACES}, optional` : undefined} error={each[i].error} htmlFor={`make-island-place-${i}`}>
            <div className="flex gap-2">
              <input
                id={`make-island-place-${i}`}
                value={x}
                maxLength={ISLAND_PLACE_MAX + 4}
                placeholder={["Noa", "Dan", "Maya", "Ari", "Tamar", "Eli"][i]}
                autoComplete="off"
                onChange={(e) => setPlaces((ps) => ps.map((p, k) => (k === i ? e.target.value : p)))}
                aria-invalid={!!each[i].error}
                className={INPUT}
              />
              {places.length > 1 && (
                <button type="button" aria-label={`Remove place ${i + 1}`} onClick={() => setPlaces((ps) => ps.filter((_, k) => k !== i))} className="h-11 shrink-0 px-2 text-lg text-neutral-400 hover:text-white">
                  ×
                </button>
              )}
            </div>
          </Field>
        ))}
        <p className="flex flex-wrap gap-x-5">
          <button type="button" disabled={places.length >= ISLAND_PLACES} onClick={() => setPlaces((ps) => [...ps, ""])} className={link}>
            Add a place
          </button>
          <button type="button" onClick={() => setRedraw((r) => (r + 1) % (ISLAND_REDRAWS + 1))} className={link}>
            Another island
          </button>
        </p>
      </div>
    </>
  );
}
