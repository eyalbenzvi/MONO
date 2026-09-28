"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { CustomSpec, VoiceParams } from "@/lib/custom/spec";
import { WordsField, useWords } from "./Field";
import type { EditorProps } from "./types";

/** The longest take: three seconds, then it stops on its own. */
const MAX_S = 3;

type Take = "idle" | "listening" | "off" | "missed";
type Recorder = { stop: () => Promise<Float32Array>; sr: number };

/** Starts listening: the microphone into a buffer on the device, nothing leaves it. Throws when the microphone is refused. */
async function listen(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  // A ScriptProcessor, not a worklet: a worklet needs a module URL the page's CSP would have to allow.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let length = 0;
  const cap = ctx.sampleRate * MAX_S;
  proc.onaudioprocess = (e) => {
    if (length >= cap) return;
    const x = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(x));
    length += x.length;
  };
  src.connect(proc);
  // Connected to the output (silent: nothing is written to it), or some browsers never run the processor.
  proc.connect(ctx.destination);
  return {
    sr: ctx.sampleRate,
    stop: async () => {
      proc.onaudioprocess = null;
      src.disconnect();
      proc.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      await ctx.close().catch(() => {});
      const out = new Float32Array(Math.min(length, cap));
      let at = 0;
      for (const c of chunks) {
        if (at >= out.length) break;
        out.set(c.subarray(0, out.length - at), at);
        at += c.length;
      }
      chunks.length = 0;
      return out;
    },
  };
}

/**
 * Your Voice: hold to hum (three seconds at most); the pitch, the two
 * strongest harmonics, the fade and the onset become the harmonograph's
 * numbers (lib/custom/voice) and the samples are dropped at once.
 */
export default function VoiceEditor({ made, arrival, onChange }: EditorProps) {
  const start = (arrival?.t === "voice" ? arrival.p : null) ?? (made.example.p as VoiceParams);
  const [n, setN] = useState<Omit<VoiceParams, "w">>({ a: start.a, b: start.b, d: start.d, ph: start.ph, f: start.f });
  const [take, setTake] = useState<Take>("idle");
  const words = useWords(arrival?.t === "voice" ? (arrival.p.w ?? "") : (start.w ?? ""));
  const rec = useRef<Promise<Recorder> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const w = words.value;
  const spec: CustomSpec | null = w !== null ? { t: "voice", v: 1, p: { ...n, ...(w ? { w } : {}) } } : null;
  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  const begin = () => {
    if (rec.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setTake("off");
      return;
    }
    setTake("listening");
    const r = listen();
    rec.current = r;
    r.catch(() => {
      rec.current = null;
      setTake("off");
      track("voice_record", { ok: false });
    });
    timer.current = setTimeout(end, MAX_S * 1000);
  };
  const end = async () => {
    clearTimeout(timer.current);
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    let recorder: Recorder;
    try {
      recorder = await r;
    } catch {
      return;
    }
    let samples: Float32Array | null = await recorder.stop();
    const { analyseVoice } = await import("@/lib/custom/voice");
    const got = analyseVoice(samples, recorder.sr);
    samples = null;
    track("voice_record", { ok: !!got });
    if (!got) {
      setTake("missed");
      return;
    }
    setN(got);
    setTake("idle");
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const listening = take === "listening";
  return (
    <>
      <div>
        <button
          type="button"
          data-record
          aria-pressed={listening}
          onPointerDown={(e) => {
            e.preventDefault();
            begin();
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={() => listening && end()}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              begin();
            }
          }}
          onKeyUp={(e) => (e.key === " " || e.key === "Enter") && end()}
          onContextMenu={(e) => e.preventDefault()}
          className={`h-12 w-full select-none rounded-full text-sm font-semibold ring-1 transition [touch-action:none] ${listening ? "bg-white text-black ring-white" : "text-white ring-white/30 hover:bg-white/10"}`}
        >
          {listening ? "Listening…" : "Hold to record"}
        </button>
        <p className="mt-2 text-xs text-neutral-400">Only the pitch and the fade are kept. Nothing is recorded.</p>
        {take === "off" && (
          <p role="status" className="mt-2 text-xs text-neutral-300">
            The microphone is off. Allow it, or try{" "}
            <Link href="/make/line/" className="underline underline-offset-2 hover:text-white">
              Your Line
            </Link>
            .
          </p>
        )}
        {take === "missed" && (
          <p role="status" className="mt-2 text-xs text-neutral-300">
            Didn&rsquo;t catch a note. Hum for three seconds.
          </p>
        )}
      </div>
      <WordsField words={words} hint={made.wordsHint ?? ""} />
    </>
  );
}
