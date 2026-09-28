"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { City } from "@/lib/custom/spec";
import { searchCities, type Places } from "@/lib/custom/data";

export const cityLabel = (c: City) => `${c.name}, ${c.country}`;

/**
 * The place: a WAI-ARIA 1.2 combobox. Up to six cities as you type (word
 * starts in the city or its country, accents folded; lib/custom/data), arrows
 * to move, Enter to choose, Esc to close the list (a second Esc closes the sheet).
 */
export function CityField({ places, value, onChange, error, onBlur }: { places: Places | null; value: City | undefined; onChange: (c: City | null) => void; error: string; onBlur: () => void }) {
  const [text, setText] = useState(value ? cityLabel(value) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  // The city arrives with the place list (the one remembered or on the page).
  useEffect(() => {
    if (value) setText(cityLabel(value));
  }, [value]);
  const matches = useMemo(() => (places && open && text.trim() && !(value && text === cityLabel(value)) ? searchCities(places, text, 6) : []), [places, open, text, value]);
  const choose = (c: City) => {
    onChange(c);
    setText(cityLabel(c));
    setOpen(false);
  };
  return (
    <div className="relative">
      <label htmlFor="custom-place" className="mb-1 block text-xs font-medium text-neutral-400">
        Place
      </label>
      <input
        id="custom-place"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? "custom-place-error" : undefined}
        autoComplete="off"
        placeholder={places ? "Type a city" : "Loading places…"}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          if (value) onChange(null);
        }}
        onFocus={() => text && !value && setOpen(true)}
        onBlur={() => {
          setOpen(false);
          onBlur();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setOpen(true), setActive((a) => Math.min(a + 1, Math.max(0, matches.length - 1))));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
          else if (e.key === "Enter" && open && matches[active]) (e.preventDefault(), choose(matches[active]));
          else if (e.key === "Escape" && open) (e.preventDefault(), e.stopPropagation(), setOpen(false));
        }}
        className="h-11 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white"
      />
      {open && text.trim() && !(value && text === cityLabel(value)) && places && (
        <ul id={listId} role="listbox" aria-label="Places" className="mt-1 overflow-hidden rounded-xl bg-ink-850 ring-1 ring-white/10">
          {matches.length ? (
            matches.map((c, i) => (
              <li
                key={c.id}
                id={`${listId}-${c.id}`}
                role="option"
                aria-selected={i === active}
                // Chosen before the input's blur closes the list.
                onPointerDown={(e) => (e.preventDefault(), choose(c))}
                onPointerEnter={() => setActive(i)}
                className={`flex h-10 cursor-pointer items-center gap-1 truncate px-3 text-sm ${i === active ? "bg-white/10 text-white" : "text-neutral-300"}`}
              >
                <span className="truncate">{c.name}</span>
                <span className="truncate text-neutral-500">, {c.country}</span>
              </li>
            ))
          ) : (
            <li role="option" aria-selected={false} aria-disabled className="flex h-10 items-center px-3 text-sm text-neutral-400">
              No match. Try the nearest city
            </li>
          )}
        </ul>
      )}
      {error && (
        <p id="custom-place-error" className="mt-1 text-xs text-neutral-300">
          {error}
        </p>
      )}
    </div>
  );
}
