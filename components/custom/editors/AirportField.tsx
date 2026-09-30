"use client";

import { useId, useMemo, useState } from "react";
import { searchAirports, type Airport, type Airports } from "@/lib/custom/data";

/** An airport as a field shows it: "NRT · Narita International Airport, Narita". */
export const airportLabel = (a: Airport) => `${a.iata} · ${a.name}`;

/**
 * An airport from the list (data/airports), by its code or its city or its
 * name ("nrt", "tokyo", "heathrow"): a combobox, as CityField is. The chosen
 * one is reported; typing again clears it.
 */
export function AirportField({ airports, value, onChange, label, id, error }: { airports: Airports | null; value: Airport | undefined; onChange: (a: Airport | null) => void; label: string; id: string; error?: string | null }) {
  const [text, setText] = useState(value ? airportLabel(value) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const shown = value ? airportLabel(value) : text;
  const matches = useMemo(() => (airports && open && text.trim() && !value ? searchAirports(airports, text, 6) : []), [airports, open, text, value]);
  const choose = (a: Airport) => {
    onChange(a);
    setText(airportLabel(a));
    setOpen(false);
  };
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-400">
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].iata}` : undefined}
        aria-invalid={!!error}
        autoComplete="off"
        placeholder={airports ? "A city, an airport or its code" : "Loading airports…"}
        value={shown}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          if (value) onChange(null);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setOpen(true), setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1))));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((i) => Math.max(0, i - 1)));
          else if (e.key === "Enter" && open && matches[active]) (e.preventDefault(), choose(matches[active]));
          else if (e.key === "Escape" && open) (e.preventDefault(), e.stopPropagation(), setOpen(false));
        }}
        className="h-11 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white"
      />
      {open && text.trim() && !value && airports && (
        <ul id={listId} role="listbox" aria-label="Airports" className="mt-1 overflow-hidden rounded-xl bg-ink-850 ring-1 ring-white/10">
          {matches.length ? (
            matches.map((a, i) => (
              <li
                key={a.iata}
                id={`${listId}-${a.iata}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => (e.preventDefault(), choose(a))}
                onPointerEnter={() => setActive(i)}
                className={`flex h-10 cursor-pointer items-center gap-2 truncate px-3 text-sm ${i === active ? "bg-white/10 text-white" : "text-neutral-300"}`}
              >
                <span className="font-mono font-semibold">{a.iata}</span>
                <span className="truncate">{a.city}</span>
                <span className="truncate text-neutral-500">{a.name}</span>
              </li>
            ))
          ) : (
            <li role="option" aria-selected={false} aria-disabled className="flex h-10 items-center px-3 text-sm text-neutral-400">
              No airport by that name. Try its city or its code
            </li>
          )}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-neutral-300">{error}</p>}
    </div>
  );
}
