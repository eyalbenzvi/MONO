"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { packInts } from "@/lib/custom/specKit";
import { NOTES_MAX, PITCHES, PRODUCT, STEPS, isSharp, notesProblem, packNotes, pitchName, tidyNotes, unpackNotes, type Note, type Params } from "@/lib/custom/specs/musicbox";
import { WordsField, useWords } from "./Field";
import { type EditorProps } from "./types";

/** A step's length when played back (an eighth at about 136 bpm). */
const STEP_S = 0.22;
const freq = (p: number) => 261.63 * 2 ** (p / 12);
const key = (s: number, p: number) => s * PITCHES + p;
const BUTTON = "h-10 rounded-full px-3.5 text-sm font-semibold text-neutral-300 ring-1 ring-white/15 transition hover:bg-white/10 disabled:opacity-30";

/**
 * A music box's pluck: a sine and a faint high partial (a tine's), struck and
 * dying away. Playback is local to this page (Web Audio straight to the
 * speakers): nothing is recorded, sent or kept, and nothing sounds until a
 * key or Play is pressed.
 */
function pluck(ctx: AudioContext, out: AudioNode, p: number, t: number) {
  for (const [mult, level, decay] of [[1, 0.22, 1.4], [4, 0.04, 0.35]] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq(p) * mult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }
}

/** Your Music Box: notes on a step grid (the strip itself) or from a two-octave keyboard, a local playback, the title. */
export default function MusicboxEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "musicbox" ? (arrival.p as Params) : null;
  const [notes, setNotes] = useState<Note[]>(() => unpackNotes((a ?? PRODUCT.example).m) ?? []);
  const [cursor, setCursor] = useState<[step: number, pitch: number]>([0, 12]);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const words = useWords(a?.w ?? "");
  const audio = useRef<{ ctx: AudioContext; out: GainNode; raf: number } | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const tidy = tidyNotes(notes);
  const problem = notesProblem(tidy);
  const w = words.value;
  const spec: CustomSpec | null = !problem && w !== null ? { t: "musicbox", v: 1, p: { m: packInts(packNotes(tidy)), ...(w ? { w } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const specKey = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: specKey ? (JSON.parse(specKey) as CustomSpec) : null });
  }, [specKey]);

  const on = new Set(notes.map(([s, p]) => key(s, p)));
  const full = notes.length >= NOTES_MAX;

  const context = () => {
    if (audio.current) return audio.current;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    audio.current = { ctx, out, raf: 0 };
    return audio.current;
  };
  const stop = () => {
    const au = audio.current;
    if (!au) return;
    cancelAnimationFrame(au.raf);
    au.out.disconnect();
    void au.ctx.close();
    audio.current = null;
    setPlayhead(null);
    setPlaying(false);
  };
  useEffect(() => stop, []);
  const sound = (p: number) => {
    const au = context();
    if (au) pluck(au.ctx, au.out, p, au.ctx.currentTime + 0.01);
  };
  const play = () => {
    stop();
    const au = context();
    if (!au || !tidy.length) return;
    setPlaying(true);
    const t0 = au.ctx.currentTime + 0.05;
    for (const [s, p] of tidy) pluck(au.ctx, au.out, p, t0 + s * STEP_S);
    const end = tidy[tidy.length - 1][0] + 1;
    const first = notes.length ? Math.min(...notes.map(([s]) => s)) : 0;
    const tick = () => {
      const cur = audio.current;
      if (!cur) return;
      const s = Math.floor((cur.ctx.currentTime - t0) / STEP_S);
      if (s >= end + 6) return stop();
      setPlayhead(s >= 0 && s < end ? s + first : null);
      cur.raf = requestAnimationFrame(tick);
    };
    au.raf = requestAnimationFrame(tick);
  };

  /** The cursor's row kept in view inside the grid's own scroll (never the page's). */
  const moveTo = (s: number, p: number) => {
    const step = Math.max(0, Math.min(STEPS - 1, s));
    setCursor([step, Math.max(0, Math.min(PITCHES - 1, p))]);
    const el = grid.current;
    const row = el?.children[step] as HTMLElement | undefined;
    if (el && row) {
      if (row.offsetTop < el.scrollTop) el.scrollTop = row.offsetTop;
      else if (row.offsetTop + row.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = row.offsetTop + row.offsetHeight - el.clientHeight;
    }
  };
  const toggle = (s: number, p: number, advance = false) => {
    const k = key(s, p);
    if (on.has(k)) setNotes((ns) => ns.filter(([x, y]) => key(x, y) !== k));
    else if (!full) {
      setNotes((ns) => [...ns, [s, p]]);
      sound(p);
    }
    if (advance && !on.has(k)) moveTo(s + 1, p);
  };

  const [cs, cp] = cursor;
  const whites = Array.from({ length: PITCHES }, (_, p) => p).filter((p) => !isSharp(p));
  const status = `Step ${cs + 1}, ${pitchName(cp)}${on.has(key(cs, cp)) ? ", punched" : ""}`;

  return (
    <>
      <div>
        <p className="mb-1 flex items-baseline gap-2 text-xs font-medium text-neutral-400" id="make-music-grid-label">
          The strip
          <span className="text-neutral-500">
            {notes.length} of {NOTES_MAX} notes · step {cs + 1}
          </span>
        </p>
        {/* The grid is the strip: pitches across (low on the left), steps down. One tab stop: arrows move, Space punches. */}
        <div
          ref={grid}
          role="group"
          aria-labelledby="make-music-grid-label"
          aria-describedby="make-music-status"
          tabIndex={0}
          onKeyDown={(e) => {
            const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
            if (moves[e.key]) {
              e.preventDefault();
              moveTo(cs + moves[e.key][0], cp + moves[e.key][1]);
            } else if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              toggle(cs, cp);
            }
          }}
          className="relative max-h-72 overflow-y-auto rounded-xl bg-white/[0.06] p-1.5 ring-1 ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {Array.from({ length: STEPS }, (_, s) => (
            <div key={s} className={`grid grid-cols-[repeat(25,minmax(0,1fr))] ${s % 8 === 0 && s ? "border-t border-white/15" : ""} ${s === cs || s === playhead ? "bg-white/10" : ""}`}>
              {Array.from({ length: PITCHES }, (_, p) => {
                const punched = on.has(key(s, p));
                return (
                  <div key={p} aria-hidden onClick={() => (setCursor([s, p]), toggle(s, p))} className={`grid h-3.5 cursor-pointer place-items-center ${isSharp(p) ? "bg-white/[0.06]" : ""}`}>
                    <span className={`block h-2 w-2 rounded-full ${punched ? "bg-white" : s === cs && p === cp ? "ring-1 ring-white" : ""}`} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p id="make-music-status" aria-live="polite" className="sr-only">
          {status}
        </p>
      </div>

      {/* Two octaves, C4 to C6: a key punches its note on the cursor's step and moves on a step. */}
      <div>
        <p className="mb-1 text-xs font-medium text-neutral-400">Keyboard</p>
        <div className="relative h-24 select-none">
          <div className="grid h-full grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5">
            {whites.map((p) => (
              <button key={p} type="button" aria-label={pitchName(p)} aria-pressed={on.has(key(cs, p))} disabled={full && !on.has(key(cs, p))} onClick={() => toggle(cs, p, true)} className={`flex items-end justify-center rounded-b-lg pb-1 text-[10px] ring-1 ring-white/15 transition disabled:opacity-30 ${on.has(key(cs, p)) ? "bg-white text-black" : "text-neutral-500 hover:bg-white/10"}`}>
                {p % 12 === 0 ? pitchName(p) : ""}
              </button>
            ))}
          </div>
          {Array.from({ length: PITCHES }, (_, p) => p)
            .filter(isSharp)
            .map((p) => {
              // A black key sits on the line between two whites.
              const left = (whites.filter((x) => x < p).length / whites.length) * 100;
              return (
                <button
                  key={p}
                  type="button"
                  aria-label={pitchName(p)}
                  aria-pressed={on.has(key(cs, p))}
                  disabled={full && !on.has(key(cs, p))}
                  onClick={() => toggle(cs, p, true)}
                  style={{ left: `calc(${left}% - 2.2%)`, width: "4.4%" }}
                  className={`absolute top-0 h-14 rounded-b-md ring-1 ring-white/15 transition disabled:opacity-30 ${on.has(key(cs, p)) ? "bg-white" : "bg-white/20 hover:bg-white/10"}`}
                />
              );
            })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => moveTo(cs - 1, cp)} disabled={cs === 0} className={BUTTON}>
            Back
          </button>
          <button type="button" onClick={() => moveTo(cs + 1, cp)} disabled={cs === STEPS - 1} className={BUTTON}>
            Rest
          </button>
          <button type="button" onClick={() => (stop(), setNotes([]), moveTo(0, cp))} disabled={!notes.length} className={BUTTON}>
            Clear
          </button>
          <button type="button" onClick={playing ? stop : play} disabled={!notes.length} className={BUTTON}>
            {playing ? "Stop" : "Play"}
          </button>
        </div>
        {problem ? <p className="mt-2 text-xs text-neutral-300">{problem}</p> : full && <p className="mt-2 text-xs text-neutral-500">{NOTES_MAX} notes at most.</p>}
      </div>
      <WordsField words={words} hint={made.wordsHint ?? PRODUCT.wordsHint ?? ""} touched={touched} />
    </>
  );
}
