"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { FIRST_YEAR, LAST_YEAR, parseDate, parseTime, renderCustomSvg, type City, type CustomSpec, type TemplateId } from "@/lib/custom";
import { loadCanvasFonts } from "@/lib/custom/canvasSvg";
import { loadCities, loadSky, searchCities, type Places } from "@/lib/custom/data";
import { WEAK_QUALITY, assessPrint, solidBlock } from "@/lib/custom/quality";
import { inkFromCanvas } from "@/lib/custom/raster";
import type { SkyData } from "@/lib/custom/templates/sky";
import { formatPrice } from "@/lib/format";
import { STORE_POLICY } from "@/lib/store-policy";
import { useUiStore } from "@/store/useUiStore";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

const MIN_DATE = `${FIRST_YEAR}-01-01`;
const MAX_DATE = `${LAST_YEAR}-12-31`;
const DATE_ERROR = `Pick a date between ${FIRST_YEAR} and ${LAST_YEAR}`;
const YEAR_ERROR = `Pick a year between ${FIRST_YEAR} and ${LAST_YEAR}`;
/** The preview waits this long after a change (longer on a device where a render is slow). */
const DEBOUNCE = 150;
const SLOW_DEBOUNCE = 300;

/** Whether a print will print: not a solid block, and not weak by the catalogue's own line (lib/custom/quality). */
function printable(svg: string, color: BaseColor) {
  const ink = inkFromCanvas(svg, color);
  const a = assessPrint(ink);
  return !solidBlock(ink).reject && a.quality >= WEAK_QUALITY && a.flags.length === 0;
}

const cityLabel = (c: City) => `${c.name}, ${c.country}`;

/**
 * "Make it yours": the editor of a personalised print. A bottom sheet on
 * phones (at most half the screen, so the page's own picture above it is the
 * preview) and a small panel on larger screens, in MoreMenu's sheet idiom.
 * Every valid change re-draws the page picture after a short pause; closing
 * without "Use this" puts back what was there.
 */
export function EditorSheet({
  shirt,
  template,
  color,
  applied,
  onPreview,
  onApply,
  onOriginal,
  onClose,
}: {
  shirt: ShirtProduct;
  template: TemplateId;
  color: BaseColor;
  applied: CustomSpec | null;
  onPreview: (spec: CustomSpec | null) => void;
  onApply: (spec: CustomSpec) => void;
  onOriginal: () => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onClose);
  const titleId = useId();
  const [places, setPlaces] = useState<Places | null>(null);
  const [sky, setSky] = useState<SkyData | null>(null);
  const lastCity = useUiStore((s) => s.lastCity);
  const setLastCity = useUiStore((s) => s.setLastCity);

  useEffect(() => {
    let live = true;
    loadCanvasFonts();
    loadCities()
      .then((p) => live && setPlaces(p))
      .catch(() => {});
    if (template === "sky")
      loadSky()
        .then((s) => live && setSky(s))
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [template]);

  // Fields, from the print on the page, else the last city chosen.
  const [cityId, setCityId] = useState<number | null>(applied?.t === "sky" ? applied.p.c : lastCity);
  const city = cityId && places ? places.byId(cityId) : undefined;
  const [date, setDate] = useState(applied?.t === "sky" ? applied.p.d : "");
  const [time, setTime] = useState(applied?.t === "sky" ? (applied.p.t ?? "") : "");
  const [year, setYear] = useState(applied?.t === "moon" ? String(applied.p.y) : "");
  const [south, setSouth] = useState<boolean | null>(applied?.t === "moon" ? applied.p.s === 1 : null);
  const southNow = south ?? (lastCity && places ? (places.byId(lastCity)?.lat ?? 0) < 0 : false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const spec: CustomSpec | null = useMemo(() => {
    if (template === "moon") {
      const y = Number(year);
      return /^\d{4}$/.test(year) && y >= FIRST_YEAR && y <= LAST_YEAR ? { t: "moon", v: 1, p: { y, ...(southNow ? { s: 1 as const } : {}) } } : null;
    }
    if (!city || !parseDate(date) || (time && !parseTime(time))) return null;
    return { t: "sky", v: 1, p: { c: city.id, d: date, ...(time ? { t: time } : {}) } };
  }, [template, year, southNow, city, date, time]);

  // The live preview: debounced; a print that won't print well isn't shown or offered.
  const [bad, setBad] = useState(false);
  const [checked, setChecked] = useState<CustomSpec | null>(null);
  const slow = useRef(false);
  const [announce, setAnnounce] = useState("");
  const lastAnnounce = useRef(0);
  useEffect(() => {
    if (!spec || (spec.t === "sky" && !sky)) {
      setChecked(null);
      return;
    }
    const t = setTimeout(
      () => {
        const start = performance.now();
        loadCanvasFonts().then(() => {
          const svg = renderCustomSvg(spec, color, { sky: sky ?? undefined, city });
          const ok = printable(svg, color);
          if (performance.now() - start > 100) slow.current = true;
          setBad(!ok);
          setChecked(ok ? spec : null);
          onPreview(ok ? spec : null);
          if (ok && Date.now() - lastAnnounce.current > 1000) {
            lastAnnounce.current = Date.now();
            setAnnounce((a) => (a === "Preview updated" ? "Preview updated." : "Preview updated"));
          }
        });
      },
      slow.current ? SLOW_DEBOUNCE : DEBOUNCE,
    );
    return () => clearTimeout(t);
    // onPreview is the page's setter; the rest is what's drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, sky, city, color]);

  const errors = {
    city: touched.city && !city ? "Pick a city from the list" : "",
    date: touched.date && !parseDate(date) ? DATE_ERROR : "",
    time: touched.time && time && !parseTime(time) ? "Pick a time, or leave it empty" : "",
    year: touched.year && !spec && template === "moon" ? YEAR_ERROR : "",
  };
  const ready = !!spec && !!checked && checked === spec && !bad;
  const premium = formatPrice(STORE_POLICY.customPremium);

  return (
    <>
      <motion.div className="fixed inset-0 z-50 bg-black/30 md:bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[50dvh] max-w-lg overflow-y-auto rounded-t-3xl bg-ink-900 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 ring-1 ring-white/10 md:bottom-auto md:left-auto md:right-6 md:top-24 md:max-h-[80vh] md:w-80 md:rounded-2xl md:pb-4 md:shadow-2xl md:shadow-black"
        data-editor
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden />
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-base font-bold">
            {template === "sky" ? "Night Sky" : "Moon Phases"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 hover:text-white">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <form
          className="mt-2 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && spec) {
              if (spec.t === "sky") setLastCity(spec.p.c);
              onApply(spec);
            } else setTouched({ city: true, date: true, time: true, year: true });
          }}
        >
          {template === "sky" ? (
            <>
              <CityField places={places} value={city} onChange={(c) => setCityId(c?.id ?? null)} error={errors.city} onBlur={() => setTouched((t) => ({ ...t, city: true }))} />
              <Field label="Date" error={errors.date} htmlFor="custom-date">
                <input
                  id="custom-date"
                  type="date"
                  min={MIN_DATE}
                  max={MAX_DATE}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, date: true }))}
                  aria-invalid={!!errors.date}
                  aria-describedby={errors.date ? "custom-date-error" : undefined}
                  className="h-11 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white [color-scheme:dark]"
                />
              </Field>
              <Field label="Time" hint="optional" error={errors.time} htmlFor="custom-time">
                <input
                  id="custom-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, time: true }))}
                  aria-invalid={!!errors.time}
                  aria-describedby={errors.time ? "custom-time-error" : undefined}
                  className="h-11 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white [color-scheme:dark]"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Year" error={errors.year} htmlFor="custom-year">
                <input
                  id="custom-year"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="off"
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onBlur={() => setTouched((t) => ({ ...t, year: true }))}
                  aria-invalid={!!errors.year}
                  aria-describedby={errors.year ? "custom-year-error" : undefined}
                  className="h-11 w-full rounded-xl bg-white/[0.06] px-3 font-mono text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white"
                />
              </Field>
              <label className="flex h-11 cursor-pointer items-center justify-between text-sm text-neutral-300">
                Seen from the south
                <input type="checkbox" role="switch" checked={southNow} onChange={(e) => setSouth(e.target.checked)} className="peer sr-only" />
                <span aria-hidden className="relative h-6 w-10 rounded-full bg-white/15 transition peer-checked:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4 peer-checked:after:bg-black" />
              </label>
            </>
          )}
          {bad && spec && <p className="text-xs text-neutral-300">This one won&apos;t print well. Try another date</p>}
          <button type="submit" disabled={!ready} className="flex h-12 items-center justify-center rounded-full bg-white text-sm font-bold text-black transition disabled:opacity-40">
            Use this · +{premium}
          </button>
          {applied && (
            <button type="button" onClick={onOriginal} className="-my-1 h-10 text-sm text-neutral-400 underline underline-offset-4 hover:text-white">
              Use the original
            </button>
          )}
        </form>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        <span className="sr-only">{shirt.title}</span>
      </motion.div>
    </>
  );
}

function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 flex items-baseline gap-2 text-xs font-medium text-neutral-400">
        {label}
        {hint && <span className="text-neutral-500">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-neutral-300">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The place: a WAI-ARIA 1.2 combobox. Up to six cities as you type (word
 * starts in the city or its country, accents folded; lib/custom/data), arrows
 * to move, Enter to choose, Esc to close the list (a second Esc closes the sheet).
 */
function CityField({ places, value, onChange, error, onBlur }: { places: Places | null; value: City | undefined; onChange: (c: City | null) => void; error: string; onBlur: () => void }) {
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
