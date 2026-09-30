"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CityField, cityLabel } from "@/components/custom/CityField";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { Icon } from "@/components/Icon";
import { autoCity } from "@/components/custom/editors/DateEditor";
import { Field, WORDS_INPUT_MAX, useLexicon, useWords } from "@/components/custom/editors/Field";
import { INPUT } from "@/components/custom/editors/types";
import { drawPrint } from "@/components/custom/useCustom";
import { STAGE_BG } from "@/components/stage";
import { getShirtById } from "@/lib/catalog";
import { loadCities, type Places } from "@/lib/custom/data";
import { TWO_EXAMPLE, TWO_NAME_MAX, cleanName, forTwo, readTwo, writeTwo, type TwoCard, type TwoQuery } from "@/lib/custom/forTwo";
import { markFrom } from "@/lib/custom/makeFrom";
import { madeBySlug, type MadeProduct } from "@/lib/custom/products";
import { FIRST_YEAR, LAST_YEAR, customDay, encodeMake, parseDate } from "@/lib/custom/spec";
import { SIZES } from "@/lib/images";

const pad = (n: number) => String(n).padStart(2, "0");
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** A name field's state: the name to print (undefined when empty, null while it can't be printed) and why not. */
function useName(initial = "") {
  const [text, setText] = useState(initial);
  const lex = useLexicon(!!text.trim());
  const clean = text.trim() ? cleanName(text) : undefined;
  const refused = clean && lex ? lex.wordsProblem(clean) : null;
  const value = clean === undefined ? undefined : clean && lex && !refused ? clean : null;
  const error = refused ?? (clean === null ? `Up to ${TWO_NAME_MAX} letters` : null);
  return { text, setText, value, error };
}

/**
 * For two: a couple's date (and what it was, their names, a place), and
 * every print it makes, each card drawn with their inputs and leading to its
 * product page with everything filled in. Before a date, the same cards with
 * our example. What's typed stays on the device and in the address, so the
 * page can be sent as it is.
 */
export function ForTwo() {
  const [date, setDate] = useState("");
  const words = useWords();
  const nameA = useName();
  const nameB = useName();
  /** The place: the visitor's own (undefined), none, or a chosen city's id. */
  const [choice, setChoice] = useState<number | "none" | undefined>(undefined);
  const [changing, setChanging] = useState(false);
  /** Where they live now (a city id, optional): the signpost between it and the place. */
  const [homeId, setHomeId] = useState<number | undefined>(undefined);
  const [addingHome, setAddingHome] = useState(false);
  const [touchedDate, setTouchedDate] = useState(false);
  const [ready, setReady] = useState(false);
  const [places, setPlaces] = useState<Places | null>(null);
  const [noPlaces, setNoPlaces] = useState(false);

  // The address first (what a shared link carries), then the place list.
  useEffect(() => {
    const q = readTwo(new URLSearchParams(window.location.search));
    if (q.d) setDate(q.d);
    if (q.w) words.setText(q.w);
    if (q.a) nameA.setText(q.a);
    if (q.b) nameB.setText(q.b);
    if (q.c !== undefined) setChoice(q.c);
    if (q.h !== undefined) setHomeId(q.h);
    setReady(true);
    let live = true;
    loadCities()
      .then((p) => live && setPlaces(p))
      .catch(() => live && setNoPlaces(true));
    return () => {
      live = false;
    };
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const here = useMemo(() => (places ? autoCity(places) : undefined), [places]);
  const chosen = typeof choice === "number" && places ? places.byId(choice) : undefined;
  const city = choice === "none" ? null : (chosen ?? here ?? null);
  const home = homeId !== undefined && places ? (places.byId(homeId) ?? null) : null;

  const own = !!parseDate(date);
  const today = useMemo(localToday, []);
  // Before a date, our example fills whatever's empty.
  const pick = (v: string | null | undefined, ex: string) => (v === null ? undefined : (v ?? (own ? undefined : ex)));
  const inputs = { d: own ? date : TWO_EXAMPLE.d, w: pick(words.value, TWO_EXAMPLE.w), a: pick(nameA.value, TWO_EXAMPLE.a), b: pick(nameB.value, TWO_EXAMPLE.b), place: city, home };
  const key = JSON.stringify([inputs.d, inputs.w, inputs.a, inputs.b, city?.id ?? (places || choice === "none" ? 0 : -1), home?.id ?? 0]);
  // The cards wait for the place list (a sky needs its city), then follow the fields a moment behind the typing.
  const [cards, setCards] = useState<TwoCard[]>([]);
  const latest = useRef(inputs);
  latest.current = inputs;
  useEffect(() => {
    if (!ready || (!places && !noPlaces && choice !== "none")) return;
    const t = setTimeout(() => setCards(forTwo(latest.current, today)), 250);
    return () => clearTimeout(t);
  }, [key, ready, places, noPlaces, choice, today]);

  // The address keeps what's typed (never the example), so a reload or a sent link opens the page as it is.
  useEffect(() => {
    if (!ready) return;
    const q: TwoQuery = {};
    if (own) q.d = date;
    if (words.value) q.w = words.value;
    if (nameA.value) q.a = nameA.value;
    if (nameB.value) q.b = nameB.value;
    if (choice === "none") q.c = "none";
    else if (chosen) q.c = chosen.id;
    else if (own && here) q.c = here.id;
    if (home) q.h = home.id;
    const s = writeTwo(q);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${s ? `?${s}` : ""}${window.location.hash}`);
  }, [ready, own, date, words.value, nameA.value, nameB.value, choice, chosen, here, home]);

  const dateError = touchedDate && date && !own ? `A date from ${FIRST_YEAR} to ${LAST_YEAR}.` : "";

  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-4 2xl:max-w-6xl">
        <div className="mb-2">
          <Link href="/make/" className="inline-flex h-10 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
            <Icon name="arrow-left" className="h-4 w-4" /> Make
          </Link>
        </div>
        <h1 className="text-balance text-3xl font-black tracking-tight md:text-5xl">For two</h1>
        <p className="mt-3 max-w-xl text-sm text-neutral-400">One date of you two, and every print it makes.</p>

        <form className="mt-6 grid max-w-xl gap-4" onSubmit={(e) => e.preventDefault()} data-two-form>
          <Field label="The date" error={dateError} htmlFor="two-date">
            <input
              id="two-date"
              type="date"
              min={`${FIRST_YEAR}-01-01`}
              max={`${LAST_YEAR}-12-31`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={() => setTouchedDate(true)}
              aria-invalid={!!dateError}
              className={`${INPUT} h-12 text-base`}
            />
          </Field>
          <Field label="What it was" hint="optional" error={words.error} htmlFor="two-words">
            <input
              id="two-words"
              value={words.text}
              maxLength={WORDS_INPUT_MAX}
              placeholder={TWO_EXAMPLE.w}
              autoComplete="off"
              onChange={(e) => words.setText(e.target.value)}
              onBlur={words.touch}
              aria-invalid={!!words.error}
              className={INPUT}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="One of you" hint="optional" error={nameA.error} htmlFor="two-a">
              <input id="two-a" value={nameA.text} maxLength={TWO_NAME_MAX + 4} placeholder={TWO_EXAMPLE.a} autoComplete="off" onChange={(e) => nameA.setText(e.target.value)} aria-invalid={!!nameA.error} className={INPUT} />
            </Field>
            <Field label="The other" hint="optional" error={nameB.error} htmlFor="two-b">
              <input id="two-b" value={nameB.text} maxLength={TWO_NAME_MAX + 4} placeholder={TWO_EXAMPLE.b} autoComplete="off" onChange={(e) => nameB.setText(e.target.value)} aria-invalid={!!nameB.error} className={INPUT} />
            </Field>
          </div>
          {changing ? (
            <div>
              <CityField
                places={places}
                value={chosen}
                onChange={(c) => {
                  if (!c) return;
                  setChoice(c.id);
                  setChanging(false);
                }}
                error=""
                onBlur={() => {}}
              />
              <button type="button" onClick={() => (setChoice("none"), setChanging(false))} className="mt-1 h-10 text-sm text-neutral-300 underline underline-offset-4 hover:text-white">
                Leave the place out
              </button>
            </div>
          ) : (
            <p className="flex min-h-10 flex-wrap items-center gap-x-2 text-sm text-neutral-400" data-place>
              {city ? (
                <span>
                  Seen from <span className="text-neutral-200">{cityLabel(city)}</span>
                </span>
              ) : (
                <span>{choice === "none" || noPlaces ? "No place: no sky, no globe" : "Finding your place…"}</span>
              )}
              <button type="button" onClick={() => setChanging(true)} className="-my-2 h-10 text-neutral-300 underline underline-offset-4 hover:text-white">
                {choice === "none" ? "Add one" : "Change"}
              </button>
            </p>
          )}
          {addingHome ? (
            <CityField
              id="two-home"
              label="Where you live now"
              places={places}
              value={home ?? undefined}
              onChange={(c) => {
                if (!c) return;
                setHomeId(c.id);
                setAddingHome(false);
              }}
              error=""
              onBlur={() => {}}
            />
          ) : (
            <p className="flex min-h-10 flex-wrap items-center gap-x-2 text-sm text-neutral-400" data-home>
              {home ? (
                <span>
                  Living in <span className="text-neutral-200">{cityLabel(home)}</span>
                </span>
              ) : (
                <span>Where you live now: optional, for a signpost</span>
              )}
              <button type="button" onClick={() => setAddingHome(true)} className="-my-2 h-10 text-neutral-300 underline underline-offset-4 hover:text-white">
                {home ? "Change" : "Add it"}
              </button>
              {home && (
                <button type="button" onClick={() => setHomeId(undefined)} className="-my-2 h-10 text-neutral-300 underline underline-offset-4 hover:text-white">
                  Leave it out
                </button>
              )}
            </p>
          )}
        </form>

        <section className="mt-10" aria-labelledby="two-prints">
          <h2 id="two-prints" className={own ? "text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400" : "sr-only"}>
            {own ? `From ${customDay({ t: "night", v: 1, p: { d: date } })}` : "Shown with our example"}
          </h2>
          {!own && <p className="text-xs text-neutral-500">Put in your date.</p>}
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4" data-two={own ? "yours" : "example"}>
            {cards.length
              ? cards.map((c) => (
                  <li key={c.slug}>
                    <TwoCardView made={madeBySlug(c.slug) as MadeProduct} card={c} />
                  </li>
                ))
              : Array.from({ length: 4 }, (_, i) => (
                  <li key={i} aria-hidden>
                    <div className={`rounded-2xl px-2 pb-2 pt-9 ${STAGE_BG}`}>
                      <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-white/[0.03]" />
                    </div>
                  </li>
                ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** One print as the Make index draws it (the print on its tee, the name), its line for them, and the way in: the product page with it filled in. */
function TwoCardView({ made, card }: { made: MadeProduct; card: TwoCard }) {
  const shirt = getShirtById(made.id);
  const color = shirt?.baseColor ?? "black";
  // The last drawing stays until the next is ready (no flash while typing).
  const [svg, setSvg] = useState<string | null>(null);
  const make = encodeMake(card.spec);
  useEffect(() => {
    let live = true;
    drawPrint(card.spec, color)
      .then((d) => live && setSvg(d.svg))
      .catch(() => {});
    return () => {
      live = false;
    };
    // The spec by its link: the same print isn't redrawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, color]);
  return (
    <div className="group relative isolate" data-card={made.slug}>
      <div className={`relative overflow-hidden rounded-2xl px-2 pb-2 pt-9 ${STAGE_BG}`}>
        {shirt && svg ? (
          <CustomMockup shirt={shirt} svg={svg} color={color} sizes={SIZES.grid} crop className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-white/[0.03]" aria-hidden />
        )}
      </div>
      <div className="mt-2 px-0.5">
        <Link
          href={`/make/${made.slug}/?make=${make}`}
          data-made={made.slug}
          onClick={() => markFrom("two")}
          className="block truncate rounded-2xl text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-white focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-black"
        >
          {made.name}
        </Link>
        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{card.line}</p>
      </div>
    </div>
  );
}
