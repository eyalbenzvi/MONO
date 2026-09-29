"use client";

import { useId, useState } from "react";
import type { Lines } from "@/lib/custom/kit";
import { CAP_LINES, CAP_MAX, cleanWords, type Cap, type CapRule } from "@/lib/custom/specKit";
import { Field, nameLine, unprintable, useLexicon } from "./Field";
import { INPUT } from "./types";

const LABELS = ["The title", "The line under it", "The line under that"];
const LINK = "h-8 text-xs text-neutral-300 underline underline-offset-4 hover:text-white";

/** A caption line as typed: null (ours), or the visitor's text (maybe half typed, or "" to hide the line). */
export type CapDraft = (string | null)[];

/**
 * Why a line the visitor typed can't print (one line), or null: the words'
 * rule, its length, the lexicon (a brand, a slur), or empty where the line
 * can't be hidden. `lex` null: still loading (no verdict yet on the words).
 */
export function capLineProblem(text: string, i: number, rule: CapRule, lex: { wordsProblem: (s: string) => string | null } | null): string | null {
  if (text === "") return rule.hide?.[i] ? null : "This line can't be left empty. Reset it, or type a line.";
  const max = (rule.max ?? CAP_MAX)[i];
  const clean = cleanWords(text, max);
  if (!clean || clean !== text.replace(/\s+/g, " ").trim()) return unprintable(text) ? nameLine(text, max) : `Up to ${max} letters and numbers.`;
  return lex ? lex.wordsProblem(clean) : null;
}

/** The drafts as a spec's cap: each typed line tidied; trailing ours dropped; null when a line can't print (or the lexicon isn't in yet). */
export function capFromDrafts(drafts: CapDraft, rule: CapRule, lex: { wordsProblem: (s: string) => string | null } | null): Cap | null {
  const out: Cap = [];
  for (let i = 0; i < CAP_LINES; i++) {
    const d = drafts[i] ?? null;
    if (d === null) out.push(null);
    else {
      if (capLineProblem(d, i, rule, lex) || (d !== "" && !lex)) return null;
      out.push(d === "" ? "" : cleanWords(d, (rule.max ?? CAP_MAX)[i]));
    }
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/**
 * "Edit the text under the print": the caption's lines, collapsed until
 * asked for. Each shows the line we print now (following the other fields as
 * they change) until the visitor types their own; then it stays theirs, with
 * a Reset back to ours. A line the product lets go can be hidden. The same
 * errors as every field (the lexicon, the length, the words' rule).
 */
export function CaptionField({ ours, value, onChange, rule, follows }: { ours: Lines; value: CapDraft; onChange: (next: CapDraft) => void; rule: CapRule; follows: string }) {
  const [open, setOpen] = useState(() => value.some((v) => v !== null));
  const id = useId();
  const lex = useLexicon(open || value.some((v) => !!v));
  const set = (i: number, v: string | null) => {
    const next = [...value];
    while (next.length < CAP_LINES) next.push(null);
    next[i] = v;
    onChange(next);
  };
  const edited = value.filter((v) => v !== null).length;
  return (
    <div className="rounded-2xl ring-1 ring-white/10" data-caption>
      <button type="button" aria-expanded={open} aria-controls={`${id}-lines`} onClick={() => setOpen((o) => !o)} className="flex h-11 w-full items-center justify-between px-3 text-left text-sm text-neutral-200">
        <span>Edit the text under the print{edited ? <span className="text-neutral-400"> · {edited} yours</span> : null}</span>
        <span aria-hidden className="text-neutral-400">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div id={`${id}-lines`} className="grid gap-3 px-3 pb-3">
          {[0, 1, 2].map((i) => {
            const mine = value[i] ?? null;
            const shown = mine ?? ours[i] ?? "";
            const error = mine !== null ? capLineProblem(mine, i, rule, lex) : null;
            const max = (rule.max ?? CAP_MAX)[i];
            const hint = mine === null ? (ours[i] ? "ours" : "not printed") : mine === "" ? "hidden" : `Yours. Reset to follow ${follows}.`;
            return (
              <div key={i}>
                <Field label={LABELS[i]} hint={hint} error={error} htmlFor={`${id}-cap-${i}`}>
                  <input
                    id={`${id}-cap-${i}`}
                    value={shown}
                    maxLength={max + 4}
                    placeholder={mine === "" ? "Hidden" : "Type a line"}
                    autoComplete="off"
                    onChange={(e) => set(i, e.target.value)}
                    // Our line, selected on the way in: typing replaces it (a line of one's own, not ours with more on the end).
                    onFocus={(e) => mine === null && e.currentTarget.select()}
                    aria-invalid={!!error}
                    className={INPUT}
                    data-cap-line={i}
                  />
                </Field>
                <div className="mt-0.5 flex gap-4">
                  {mine !== null && (
                    <button type="button" onClick={() => set(i, null)} className={LINK} data-cap-reset={i}>
                      Reset
                    </button>
                  )}
                  {rule.hide?.[i] && mine !== "" && (ours[i] || mine) && (
                    <button type="button" onClick={() => set(i, "")} className={LINK}>
                      Hide this line
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
