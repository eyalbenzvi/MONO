"use client";

import { radioKeys } from "@/components/ui";

/** One choice among a few, as a row of pills (a radiogroup: arrow keys move, one tab stop). */
export function Segmented<T extends string | number>({ label, options, value, onChange, format = String }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string }) {
  const keys = radioKeys(options, value, onChange);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400" id={`seg-${label}`}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`seg-${label}`} className="flex flex-wrap gap-1.5">
        {options.map((o, i) => (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
            {...keys(i)}
            className={`h-10 rounded-full px-3.5 text-sm font-semibold ring-1 transition ${o === value ? "bg-white text-black ring-white" : "text-neutral-300 ring-white/15 hover:bg-white/10"}`}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** An on/off setting as a switch (a checkbox with role="switch"). */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex h-11 cursor-pointer items-center justify-between text-sm text-neutral-300">
      {label}
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative h-6 w-10 rounded-full bg-white/15 transition peer-checked:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4 peer-checked:after:bg-black" />
    </label>
  );
}
