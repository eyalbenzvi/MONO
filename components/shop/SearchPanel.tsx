"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { SHIRTS, assetUrl, getShirtById } from "@/lib/catalog";
import { printPath } from "@/lib/images";
import type { SearchResult } from "@/lib/search/engine";
import { sameFacet, type Facet } from "@/lib/search/facetCodec";
import { teeColor } from "@/types/shirt";
import type { SearchRuntime } from "./useShopSearch";

export interface SearchBoxProps {
  runtime: SearchRuntime | null | undefined;
  query: string;
  facets: Facet[];
  result: SearchResult | null;
  /** How many tees the grid shows. */
  count: number;
  literal: boolean;
  tasteKnown: boolean;
  /** Bumped to move focus into the input (the "/" key, the search button). */
  focusNonce: number;
  onQuery: (q: string) => void;
  onFacets: (facets: Facet[]) => void;
  onLiteral: () => void;
  onCommit: () => void;
  onClose: () => void;
  onClear: () => void;
}

type Item = { key: string; label: string; kind?: string; run: () => void };

const LABEL = "text-xs text-muted";
const chip = (on = false) =>
  `flex h-11 min-w-11 shrink-0 items-center gap-1.5 rounded-control px-3.5 text-[13px] font-medium transition-colors duration-150 ${
    on ? "bg-white text-black" : "text-neutral-200 ring-1 ring-inset ring-white/20 hover:bg-white/5"
  }`;
/** A word completion reads as plain text; a facet is a ringed chip — two kinds, told apart without colour. */
const word = (on = false) =>
  `flex h-11 min-w-11 shrink-0 items-center rounded-control px-2.5 text-[13px] transition-colors duration-150 ${on ? "bg-white text-black" : "text-neutral-300 underline-offset-4 hover:underline"}`;
const WEEK = 7 * 86_400_000;

/**
 * The shop's search, in its sheet: the field at the bottom (next to the
 * keyboard), the words and accepted facets in it; above it, suggestions
 * while typing and, while the field is empty, the prepared parameters,
 * every one built from the index so none leads to nothing. The grid behind
 * is the result: Enter (or a facet) shows it.
 */
export default function SearchPanel(p: SearchBoxProps) {
  const input = useRef<HTMLInputElement>(null);
  const suggest = useRef<HTMLDivElement>(null);
  const pills = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [more, setMore] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const { runtime, query, facets, result } = p;

  useEffect(() => {
    if (runtime) setRecent(runtime.mod.readRecent());
  }, [runtime]);
  // Focus only when asked (the button, "/"): a search opened from a link ("More like this", a reload) doesn't raise the keyboard.
  useEffect(() => {
    if (p.focusNonce > 0) input.current?.focus();
  }, [p.focusNonce]);
  useEffect(() => setActive(-1), [query]);
  // The selected suggestion in view (the row scrolls sideways; the page doesn't move).
  useEffect(() => {
    const row = suggest.current;
    const el = row?.querySelector<HTMLElement>(`#suggest-${active}`);
    if (row && el && (el.offsetLeft < row.scrollLeft || el.offsetLeft + el.offsetWidth > row.scrollLeft + row.clientWidth)) row.scrollLeft = el.offsetLeft - 16;
  }, [active]);
  // A pill added: the words stay in sight at the end of the field.
  useEffect(() => {
    if (pills.current) pills.current.scrollLeft = pills.current.scrollWidth;
  }, [facets.length]);
  // The screen reader hears the result once typing settles, not on every key.
  const [spoken, setSpoken] = useState("");

  const label = (f: Facet) => (runtime ? runtime.mod.facetLabel(runtime.index, f) : f.value);
  const add = (f: Facet) => {
    if (!facets.some((x) => sameFacet(x, f))) p.onFacets([...facets, f]);
    setPanelOpen(false);
  };
  const remove = (f: Facet) => p.onFacets(facets.filter((x) => !sameFacet(x, f)));

  // While typing: completions of the last word, then the facets the words suggest (at most 8).
  const items: Item[] = useMemo(() => {
    if (!query.trim() || !result) return [];
    const out: Item[] = result.completions.map((w) => ({ key: `w:${w}`, label: w, kind: undefined, run: () => p.onQuery(query.replace(/\S*$/, `${w} `)) }));
    for (const s of result.suggestions)
      if (!facets.some((f) => sameFacet(f, s.facet))) out.push({ key: `f:${s.facet.kind}:${s.facet.value}`, label: s.label, kind: s.kind, run: () => add(s.facet) });
    return out.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, result, facets]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) items[active].run();
      else {
        p.onCommit();
        if (runtime && query.trim()) setRecent(runtime.mod.pushRecent(query));
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (query) p.onQuery("");
      else {
        input.current?.blur();
        p.onClose();
      }
    } else if (e.key === "Backspace" && !query && facets.length) {
      remove(facets[facets.length - 1]);
    }
  };
  const clearAll = () => {
    if (query) p.onQuery("");
    if (facets.length) p.onFacets([]);
    input.current?.focus();
  };

  const showSuggest = items.length > 0;
  const showPanel = panelOpen && !query.trim() && !!runtime;
  const corrected = !p.literal && result?.corrected.length ? result.corrected : null;
  const like = facets.find((f) => f.kind === "like");
  const likeTitle = like ? getShirtById(like.value)?.title : undefined;
  const n = p.count;
  const status = !result ? "" : result.relaxed ? `No exact match for “${query.trim() || facets.map(label).join(", ")}”. Closest:` : corrected ? `Showing ${corrected.map((c) => c.to).join(" ")}` : likeTitle && !query.trim() ? `Closest to ${likeTitle}` : `${n} ${n === 1 ? "tee" : "tees"}`;
  useEffect(() => {
    const t = setTimeout(() => setSpoken(status), 500);
    return () => clearTimeout(t);
  }, [status]);

  const field = (
    <div className="flex h-12 min-w-0 items-center gap-1.5 rounded-control pl-3 pr-1 ring-1 ring-inset ring-white/25 focus-within:ring-white/60">
      <Icon name="search" className="h-4 w-4 shrink-0 text-muted" />
      <div ref={pills} className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {facets.map((f) => (
          <span key={`${f.kind}:${f.value}`} title={label(f)} className="flex h-8 max-w-[10rem] shrink-0 items-center gap-1 rounded-control bg-white pl-2.5 pr-1 text-xs font-medium text-black">
            {f.kind === "like" && <LikeThumb id={f.value} />}
            <span className="truncate">{label(f)}</span>
            <button type="button" onClick={() => remove(f)} aria-label={`Remove ${label(f)}`} className="relative flex h-6 w-6 shrink-0 items-center justify-center before:absolute before:-inset-2.5 before:content-[''] hover:bg-black/10">
              <Icon name="x" className="h-3 w-3" strokeWidth={3} />
            </button>
          </span>
        ))}
        <input
          ref={input}
          data-autofocus
          type="search"
          role="combobox"
          aria-expanded={showSuggest || showPanel}
          aria-controls={showPanel ? "search-panel" : "search-suggest"}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && items[active] ? `suggest-${active}` : undefined}
          aria-label="Search tees"
          placeholder={facets.length ? "" : "Search"}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => p.onQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setFocused(true);
            setPanelOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onClick={() => setPanelOpen(true)}
          className="h-11 min-w-[5rem] flex-1 bg-transparent text-base text-white outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      {(query || facets.length > 0) && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={clearAll} aria-label="Clear" className="flex h-11 w-11 shrink-0 items-center justify-center text-neutral-300 hover:text-white">
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div
      className="flex min-h-0 flex-col"
      data-focused={focused || undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && e.target !== input.current) {
          e.preventDefault();
          input.current?.focus();
        }
      }}
    >
      {/* Above the field: suggestions, or the prepared parameters, then what the words found. */}
      <div className="min-h-0">
        {showSuggest && (
          <div ref={suggest} id="search-suggest" role="listbox" aria-label="Suggestions" className="flex flex-wrap items-center gap-1.5 pb-3">
            {items.map((it, i) => (
              <button
                key={it.key}
                id={`suggest-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={it.run}
                aria-label={it.kind ? `${it.label}, ${it.kind} filter` : `${it.label}, word`}
                className={it.kind ? chip(i === active) : word(i === active)}
              >
                {it.label}
                {it.kind && <span className={i === active ? "text-muted" : "text-muted"}>· {it.kind}</span>}
              </button>
            ))}
          </div>
        )}

        {showPanel && runtime && (
          <Prepared runtime={runtime} facets={facets} tasteKnown={p.tasteKnown} recent={recent} more={more} setMore={setMore} add={add}
            onQuery={(q) => { p.onQuery(`${q} `); setPanelOpen(false); }}
            onForget={(q) => setRecent(runtime.mod.removeRecent(q))} />
        )}

        {(query.trim() || facets.length > 0) && result && (
          <p className="pb-3 text-xs text-muted">
            {result.relaxed ? (
              <>No exact match for &ldquo;{query.trim() || facets.map(label).join(", ")}&rdquo;. Closest:</>
            ) : corrected ? (
              <>
                Showing <span className="text-white">{corrected.map((c) => c.to).join(" ")}</span> ·{" "}
                <button type="button" onClick={p.onLiteral} className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-white">
                  Search for &ldquo;{corrected.map((c) => c.from).join(" ")}&rdquo;
                </button>
              </>
            ) : likeTitle && !query.trim() ? (
              <>
                Closest to <span className="text-neutral-300">{likeTitle}</span>
              </>
            ) : (
              <span className="tabular-nums">
                {n.toLocaleString("en-US")} {n === 1 ? "tee" : "tees"}
              </span>
            )}
          </p>
        )}
      </div>
      {field}
      {/* Always there, updated once typing settles. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {spoken}
      </p>
    </div>
  );
}

/** The prepared parameters (the field focused and empty): groups built from the index, only values with designs. */
function Prepared({ runtime, facets, tasteKnown, recent, more, setMore, add, onQuery, onForget }: {
  runtime: SearchRuntime;
  facets: Facet[];
  tasteKnown: boolean;
  recent: string[];
  more: boolean;
  setMore: (v: boolean) => void;
  add: (f: Facet) => void;
  onQuery: (q: string) => void;
  onForget: (q: string) => void;
}) {
  const { index, mod } = runtime;
  const t = index.file.tables;
  const on = (f: Facet) => facets.some((x) => sameFacet(x, f));
  const facetChips = (kind: Facet["kind"], entries: { id: string; label: string; count: number }[]) =>
    entries.filter((e) => e.count > 0).map((e) => ({ f: { kind, value: e.id } as Facet, label: e.label }));
  const now = Date.now();
  const hasNew = SHIRTS.some((s) => now >= s.dropDate && now < s.dropDate + WEEK);
  const subjects = mod.subjectChips(index);
  const groups: { name: string; body: ReactNode }[] = [];
  const row = (chips: { f: Facet; label: string }[]) =>
    chips.map(({ f, label }) => (
      <button key={`${f.kind}:${f.value}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(f)} aria-pressed={on(f)} className={chip(on(f))}>
        {label}
      </button>
    ));
  const look = facetChips("look", t.look);
  if (look.length) groups.push({ name: "Look", body: row(look) });
  if (subjects.length)
    groups.push({
      name: "Subject",
      body: subjects.map((s) => (
        <button key={s.query} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onQuery(s.query)} className={chip()}>
          {s.label}
        </button>
      )),
    });
  const made = facetChips("medium", t.medium);
  if (made.length) groups.push({ name: "Made", body: row(made) });
  const eras = [...facetChips("era", t.era.filter((e) => e.id.startsWith("c")).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))), ...(hasNew ? [{ f: { kind: "new", value: "week" } as Facet, label: "New this week" }] : [])];
  if (eras.length) groups.push({ name: "Era", body: row(eras) });
  const sources = facetChips("source", t.source);
  if (sources.length) groups.push({ name: "Source", body: row(sources) });
  if (tasteKnown)
    groups.push({
      name: "Your edit",
      body: row([
        { f: { kind: "seen", value: "no" }, label: mod.facetLabel(index, { kind: "seen", value: "no" }) },
        { f: { kind: "match", value: "top" }, label: mod.facetLabel(index, { kind: "match", value: "top" }) },
      ]),
    });
  if (recent.length)
    groups.push({
      name: "Recent",
      body: recent.map((q) => (
        <span key={q} className={`${chip()} pr-0`}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onQuery(q)} className="h-11">
            {q}
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onForget(q)} aria-label={`Forget ${q}`} className="flex h-11 w-11 items-center justify-center text-muted hover:text-white">
            <Icon name="x" className="h-3 w-3" />
          </button>
        </span>
      )),
    });

  return (
    // Short enough to leave the grid in sight (the phone's keyboard takes half the screen); it fades out where it scrolls, and a hairline ends it.
    <div id="search-panel" className="pb-3">
      <div>
      {groups.map((g, i) => (
        // Phones: one sideways row per group, LOOK and SUBJECT first and the rest behind "More filters".
        <section key={g.name} className={`mb-3 ${i >= 2 && !more ? "hidden sm:block" : ""}`}>
          <h3 className={`mb-2 ${LABEL}`}>{g.name}</h3>
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">{g.body}</div>
        </section>
      ))}
      </div>
      {groups.length > 2 && !more && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setMore(true)} className="inline-flex min-h-11 items-center text-xs text-neutral-300 underline underline-offset-2 hover:text-white sm:hidden">
          More filters
        </button>
      )}
    </div>
  );
}

/** A tiny print of the design "Like this" starts from. */
function LikeThumb({ id }: { id: string }) {
  const s = getShirtById(id);
  if (!s) return null;
  const c = teeColor(s, null);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={assetUrl(printPath(s, c, 480))} alt="" className={`h-5 w-4 rounded-sm object-contain ${c === "black" ? "bg-black" : "bg-white ring-1 ring-black/10"}`} />
  );
}
