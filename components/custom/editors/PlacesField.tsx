"use client";

import { useState } from "react";
import { CityField } from "@/components/custom/CityField";
import type { Places } from "@/lib/custom/data";
import { FIRST_YEAR, LAST_YEAR, type PlaceRow } from "@/lib/custom/specKit";
import { INPUT } from "./types";

const LINK = "h-11 px-1 text-neutral-300 underline underline-offset-4 hover:text-white disabled:opacity-30";

/** A row as typed: the city, and its year as text (a year being typed isn't a year yet). */
export interface PlaceDraft {
  c: number;
  year: string;
}
export const draftsOf = (rows: readonly PlaceRow[]): PlaceDraft[] => rows.map((r) => ({ c: r.c, year: r.y === undefined ? "" : String(r.y) }));
/** The rows the drafts make, or null while a year is half typed or out of range. */
export function rowsOf(drafts: readonly PlaceDraft[]): PlaceRow[] | null {
  const out: PlaceRow[] = [];
  for (const d of drafts) {
    if (!d.year) out.push({ c: d.c });
    else if (/^\d{4}$/.test(d.year) && Number(d.year) >= FIRST_YEAR && Number(d.year) <= LAST_YEAR) out.push({ c: d.c, y: Number(d.year) });
    else return null;
  }
  return out;
}

/**
 * Places and years (Your World Tour, Your Signpost): an ordered list of up to
 * `max` cities, each from the place list (never free text), each with an
 * optional year; a place field adds the next, and each row can move up or
 * down, or go. The spec packs them (lib/custom/specKit packPlaces).
 */
export function PlacesField({ places, value, onChange, max, label, years = true, error }: { places: Places | null; value: PlaceDraft[]; onChange: (next: PlaceDraft[]) => void; max: number; label: string; years?: boolean; error?: string | null }) {
  const [adding, setAdding] = useState(0);
  const move = (i: number, by: number) => {
    const next = [...value];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400" id="make-places-list">
        {label} <span className="text-muted">up to {max}</span>
      </p>
      <ol aria-labelledby="make-places-list" className="space-y-1" data-places>
        {value.map((row, i) => {
          const c = places?.byId(row.c);
          const name = c ? `${c.name}, ${c.country}` : "Loading places…";
          const badYear = !!row.year && !(/^\d{4}$/.test(row.year) && Number(row.year) >= FIRST_YEAR && Number(row.year) <= LAST_YEAR);
          return (
            <li key={`${i}-${row.c}`} className="flex items-center gap-2 text-sm text-white">
              <span className="w-5 shrink-0 text-right font-mono text-neutral-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {years && (
                <input
                  value={row.year}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Year"
                  aria-label={`${c?.name ?? "Place"}: year`}
                  aria-invalid={badYear}
                  onChange={(e) => onChange(value.map((r, j) => (j === i ? { ...r, year: e.target.value.replace(/\D/g, "").slice(0, 4) } : r)))}
                  className={`${INPUT} h-11 w-[4.5rem] shrink-0 px-2 text-center font-mono`}
                />
              )}
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${c?.name ?? "place"} up`} className={LINK}>
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move ${c?.name ?? "place"} down`} className={LINK}>
                ↓
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${c?.name ?? "place"}`} className={LINK}>
                Remove
              </button>
            </li>
          );
        })}
      </ol>
      {error && (
        <p role="alert" className="mt-1 text-xs text-neutral-300">
          {error}
        </p>
      )}
      {value.length < max && (
        <div className="mt-2">
          {/* A fresh field for each place added (it clears once one is chosen). */}
          <CityField
            key={adding}
            id="custom-place-add"
            label="Add a place"
            places={places}
            value={undefined}
            onChange={(c) => {
              if (!c) return;
              onChange([...value, { c: c.id, year: "" }]);
              setAdding((n) => n + 1);
            }}
            error=""
            onBlur={() => {}}
          />
        </div>
      )}
    </div>
  );
}
