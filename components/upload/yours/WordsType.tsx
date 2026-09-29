"use client";

import { radioKeys } from "@/components/ui";
import { track } from "@/lib/analytics";
import { assetUrl } from "@/lib/catalog";
import type { Settings } from "@/lib/upload/client";
import { FACES, FACE_IDS, cased, letters, type Face } from "@/lib/upload/words";

/** The six names drawn in their own faces, as outlines (public/fonts/words/names.svg): the picker loads no font. */
const NAMES = assetUrl("/fonts/words/names.svg");

/**
 * The words' type, under the field: the face (six tiles, each its name in
 * that face; one whose line limit the words are over is dimmed and says so),
 * then, with two or more lines, how they sit (Same size or Fill width, and
 * Left or Centre for Same size), and Capitals. Each a radiogroup; nothing
 * here is set until tapped, and each tap reconverts.
 */
export function WordsType({ settings, lines, onSettings }: { settings: Settings; lines: string[]; onSettings: (p: Partial<Settings>) => void }) {
  const tooLong = (f: Face) => lines.some((l) => letters(cased(l.trim(), settings.caps)) > FACES[f].chars);
  const pickable = FACE_IDS.filter((f) => !tooLong(f) || f === settings.face);
  const pick = (face: Face) => {
    onSettings({ face });
    track("upload_compare", { control: "type", value: face });
  };
  const keys = radioKeys(pickable, settings.face, pick);
  const many = lines.filter((l) => l.trim()).length >= 2;
  return (
    <div className="space-y-4" data-words-type>
      <div>
        <p id="words-face" className="mb-1.5 text-xs font-medium text-neutral-400">
          Type
        </p>
        <div role="radiogroup" aria-labelledby="words-face" className="grid grid-cols-3 gap-2">
          {FACE_IDS.map((f) => {
            const on = settings.face === f;
            const off = !on && tooLong(f) ? "Lines too long" : undefined;
            const i = pickable.indexOf(f);
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={on}
                aria-disabled={off ? true : undefined}
                aria-label={`${FACES[f].label}${off ? `: ${off}` : ""}`}
                onClick={() => !off && pick(f)}
                {...(i >= 0 ? keys(i) : { tabIndex: -1 })}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 transition ${on ? "bg-white text-black" : "text-white ring-1 ring-white/15 hover:ring-white/35"} ${off ? "cursor-not-allowed opacity-35" : ""}`}
                data-face={f}
              >
                <svg aria-hidden className="h-6 w-full" fill="currentColor">
                  <use href={`${NAMES}#face-${f}`} />
                </svg>
                {off && <span className="text-[10px] leading-none text-neutral-400">{off}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {many && (
          <Segmented
            label="Lines"
            value={settings.layout}
            options={[
              ["even", "Same size"],
              ["fill", "Fill width"],
            ]}
            onChange={(layout) => onSettings({ layout })}
          />
        )}
        {many && settings.layout === "even" && (
          <Segmented
            label="Align"
            value={settings.align}
            options={[
              ["left", "Left"],
              ["centre", "Centre"],
            ]}
            onChange={(align) => onSettings({ align })}
          />
        )}
        <Segmented
          label="Case"
          value={settings.caps ? "caps" : "typed"}
          options={[
            ["typed", "As typed"],
            ["caps", "Capitals"],
          ]}
          onChange={(v) => onSettings({ caps: v === "caps" })}
        />
      </div>
    </div>
  );
}

/** Two or three choices in a pill (a radiogroup, arrows move). */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const values = options.map(([v]) => v);
  const set = (v: T) => {
    onChange(v);
    track("upload_compare", { control: label.toLowerCase(), value: v });
  };
  const keys = radioKeys(values, value, set);
  const id = `words-${label.toLowerCase()}`;
  return (
    <div>
      <p id={id} className="mb-1.5 text-xs font-medium text-neutral-400">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10" data-segmented={label.toLowerCase()}>
        {options.map(([v, text], i) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => set(v)}
            {...keys(i)}
            className={`h-9 rounded-full px-3.5 text-sm font-semibold transition ${value === v ? "bg-white text-black" : "text-neutral-300 hover:text-white"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
