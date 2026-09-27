"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { SHIRTS, assetUrl, getShirtById } from "@/lib/catalog";
import { printPath } from "@/lib/images";
import type { SearchResult } from "@/lib/search/engine";
import { sameFacet, type Facet } from "@/lib/search/facetCodec";
import { COLORS, COLOR_LABELS, teeColor, type BaseColor } from "@/types/shirt";
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
  tee: BaseColor | null;
  /** Bumped to move focus into the input (the "/" key, the search button). */
  focusNonce: number;
  /** The row's last control (the filter icon). */
  trailing: ReactNode;
  onQuery: (q: string) => void;
  onFacets: (facets: Facet[]) => void;
  onTee: (tee: BaseColor | null) => void;
  onLiteral: () => void;
  onCommit: () => void;
  onClose: () => void;
  onClear: () => void;
}

type Item = { key: string; label: string; kind?: string; run: () => void };

const LABEL = "text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500";
const chip = (on = false) =>
  `flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-200 ${
    on ? "bg-white text-black" : "bg-white/[0.04] text-neutral-200 ring-1 ring-white/10 hover:bg-white/10"
  }`;
const WEEK = 7 * 86_400_000;

/**
 * The shop's search, open: the words and accepted facets in one field, one
 * row of suggestions while typing (the grid below is the result — no list
 * of products here), and, while the field is empty, the prepared
 * parameters, every one built from the index so none leads to nothing.
 */
export default function SearchPanel(p: SearchBoxProps) {
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [more, setMore] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const { runtime, query, facets, result } = p;

  useEffect(() => {
    if (runtime) setRecent(runtime.mod.readRecent());
  }, [runtime]);
  useEffect(() => {
    input.current?.focus();
  }, [p.focusNonce]);
  useEffect(() => setActive(-1), [query]);

  const label = (f: Facet) => (runtime ? runtime.mod.facetLabel(runtime.index, f) : f.value);
  const add = (f: Facet) => {
    if (!facets.some((x) => sameFacet(x, f))) p.onFacets([...facets, f]);
    setPanelOpen(false);
  };
  const remove = (f: Facet) => p.onFacets(facets.filter((x) => !sameFacet(x, f)));

  // While typing: completions of the last word, then the facets the words suggest (at most 8).
  const items: Item[] = useMemo(() => {
    if (!query.trim() || !result) return [];
    const out: Item[] = result.completions.map((w) => ({ key: `w:${w}`, label: w, run: () => p.onQuery(query.replace(/\S*$/, `${w} `)) }));
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

  const showSuggest = focused && items.length > 0;
  const showPanel = focused && panelOpen && !query.trim() && !!runtime;
  const corrected = !p.literal && result?.corrected.length ? result.corrected : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2">
        <div className="flex h-10 min-w-0 flex-1 animate-[fade-in_0.2s_ease-out] items-center gap-1.5 rounded-full bg-white/[0.06] pl-3 pr-1 ring-1 ring-white/10 transition-shadow duration-200 focus-within:ring-white/40">
          <Icon name="search" className="h-4 w-4 shrink-0 text-neutral-400" />
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {facets.map((f) => (
              <span key={`${f.kind}:${f.value}`} className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-white pl-2.5 pr-1 text-xs font-semibold text-black">
                {f.kind === "like" && <LikeThumb id={f.value} />}
                {label(f)}
                <button type="button" onClick={() => remove(f)} aria-label={`Remove ${label(f)}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/10">
                  <Icon name="x" className="h-3 w-3" strokeWidth={3} />
                </button>
              </span>
            ))}
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-expanded={showSuggest || showPanel}
              aria-controls="search-suggest"
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
              className="h-9 min-w-[6rem] flex-1 bg-transparent text-base text-white sm:text-sm outline-none placeholder:text-neutral-500 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <button
            type="button"
            onClick={() => (query ? p.onQuery("") : p.onClose())}
            aria-label={query ? "Clear search" : "Close search"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        {p.trailing}
      </div>

      {/* One row of suggestions: pressing keeps focus in the field (onMouseDown), so the list doesn't close under the tap. */}
      {showSuggest && (
        <div id="search-suggest" role="listbox" aria-label="Suggestions" className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
          {items.map((it, i) => (
            <button
              key={it.key}
              id={`suggest-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={it.run}
              className={chip(i === active)}
            >
              {it.label}
              {it.kind && <span className={i === active ? "text-neutral-600" : "text-neutral-500"}>· {it.kind}</span>}
            </button>
          ))}
        </div>
      )}

      {showPanel && runtime && (
        <Prepared runtime={runtime} facets={facets} tee={p.tee} tasteKnown={p.tasteKnown} recent={recent} more={more} setMore={setMore} add={add} onTee={(t) => { p.onTee(t); setPanelOpen(false); }}
          onQuery={(q) => { p.onQuery(`${q} `); setPanelOpen(false); }}
          onForget={(q) => setRecent(runtime.mod.removeRecent(q))} />
      )}

      {(query.trim() || facets.length > 0) && result && (
        <p aria-live="polite" className="mt-2 text-xs text-neutral-400">
          {result.relaxed ? (
            <>
              No exact match for &ldquo;{query.trim() || facets.map(label).join(", ")}&rdquo;. Closest:
              <button type="button" onClick={p.onClear} className="ml-1.5 font-semibold text-white underline underline-offset-2">
                Clear
              </button>
            </>
          ) : corrected ? (
            <>
              Showing <span className="font-semibold text-white">{corrected.map((c) => c.to).join(" ")}</span> ·{" "}
              <button type="button" onClick={p.onLiteral} className="underline underline-offset-2 hover:text-white">
                Search &ldquo;{corrected.map((c) => c.from).join(" ")}&rdquo; instead
              </button>
            </>
          ) : (
            <span className="font-mono tabular-nums">{p.count} tees</span>
          )}
        </p>
      )}
    </div>
  );
}

/** The prepared parameters (the field focused and empty): groups built from the index, only values with designs. */
function Prepared({ runtime, facets, tee, tasteKnown, recent, more, setMore, add, onTee, onQuery, onForget }: {
  runtime: SearchRuntime;
  facets: Facet[];
  tee: BaseColor | null;
  tasteKnown: boolean;
  recent: string[];
  more: boolean;
  setMore: (v: boolean) => void;
  add: (f: Facet) => void;
  onTee: (t: BaseColor | null) => void;
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
  groups.push({
    name: "Tee",
    body: COLORS.map((c) => (
      <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onTee(tee === c ? null : c)} aria-pressed={tee === c} className={chip(tee === c)}>
        {COLOR_LABELS[c]}
      </button>
    )),
  });
  if (tasteKnown)
    groups.push({
      name: "For me",
      body: row([
        { f: { kind: "seen", value: "no" }, label: mod.facetLabel(index, { kind: "seen", value: "no" }) },
        { f: { kind: "match", value: "top" }, label: mod.facetLabel(index, { kind: "match", value: "top" }) },
      ]),
    });
  if (recent.length)
    groups.push({
      name: "Recent",
      body: recent.map((q) => (
        <span key={q} className={`${chip()} pr-1`}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onQuery(q)}>
            {q}
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onForget(q)} aria-label={`Forget ${q}`} className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 hover:text-white">
            <Icon name="x" className="h-3 w-3" />
          </button>
        </span>
      )),
    });

  return (
    <div className="no-scrollbar mt-3 max-h-[60dvh] animate-[fade-in_0.25s_ease-out] overflow-y-auto pb-2">
      {groups.map((g, i) => (
        // On phones LOOK and SUBJECT first; the rest behind "More filters".
        <section key={g.name} className={`mb-4 ${i >= 2 && !more ? "hidden sm:block" : ""}`}>
          <h3 className={`mb-2 ${LABEL}`}>{g.name}</h3>
          <div className="flex flex-wrap gap-1.5">{g.body}</div>
        </section>
      ))}
      {groups.length > 2 && !more && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setMore(true)} className="text-xs font-semibold text-neutral-300 underline underline-offset-2 hover:text-white sm:hidden">
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
