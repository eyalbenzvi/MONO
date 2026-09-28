"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { SizeSelector, STAGE_BG } from "@/components/ui";
import { useHydrated } from "@/store/useUiStore";
import { track } from "@/lib/analytics";
import { getShirtById } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { STORE_POLICY } from "@/lib/store-policy";
import { YOURS_ID } from "@/lib/upload/designs";
import { WONT_PRINT } from "@/lib/upload/review";
import type { Prepared, Preview } from "@/lib/upload/client";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { FORCE_KEY, useMakeStore } from "@/store/makeStore";
import { useTasteStore } from "@/store/tasteStore";
import { SIZE_LABELS, type BaseColor, type ShirtSize } from "@/types/shirt";

type Choice = BaseColor | "both";
const WORDS_LINES = 3;
const WORDS_CHARS = 24;
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.svg";

const loadClient = () => import("@/lib/upload/client");

/**
 * From yours (/make/yours/): your picture, drawing or words in one ink.
 * Four steps on one page, the picture always at the top: A start (a file,
 * or words), B preview (Dots · Lines for a photograph, Full · Small, the
 * tee; a failing check says why and stops there), C rights, D size and bag.
 * Everything is converted and checked on this device (lib/upload); the
 * file never leaves it.
 */
export function YoursView() {
  return (
    <Suspense fallback={null}>
      <Yours />
    </Suspense>
  );
}

function Yours() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const replaceId = params.get("replace");
  const shirt = getShirtById(YOURS_ID)!;

  const [source, setSource] = useState<Prepared | null>(null);
  const [writing, setWriting] = useState(false);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [mode, setMode] = useState<"dots" | "lines">("dots");
  const [size, setPrintSize] = useState<"full" | "small">("full");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [choice, setChoice] = useState<Choice>("white");
  const [title, setTitle] = useState("");
  const [titleEdit, setTitleEdit] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [step, setStep] = useState<"b" | "c" | "d">("b");
  const [rights, setRights] = useState(false);
  const [open, setOpen] = useState(false);
  const selected = useCartStore((s) => sizeFor(s, YOURS_ID));
  const [teeSize, setTeeSize] = useState<ShirtSize | undefined>(undefined);
  const [nudge, setNudge] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const run = useRef(0);

  // ?review= for demos: remembered for the tab, so the order placed later carries it.
  useEffect(() => {
    const q = params.get("review");
    if (!q) return;
    try {
      sessionStorage.setItem(FORCE_KEY, q);
    } catch {
      /* storage unavailable */
    }
  }, [params]);

  // Edit (from the bag): the same file, converted again with its choices.
  useEffect(() => {
    if (!hydrated || !editId) return;
    const meta = useMakeStore.getState().uploads[editId];
    void loadClient().then(async (c) => {
      const p = await c.reopen(editId);
      if (!p) return;
      if (meta) {
        setTitle(meta.title);
        setPrintSize(meta.size);
        if (meta.mode === "dots" || meta.mode === "lines") setMode(meta.mode);
        setChoice(meta.tees[0]);
      }
      setSource(p);
    });
  }, [hydrated, editId]);

  // Convert whenever the source or a control changes (in the worker; stale results are dropped).
  useEffect(() => {
    if (!source) return;
    const n = ++run.current;
    setBusy(true);
    void loadClient()
      .then((c) => c.convert(source, { mode, size }))
      .then((p) => {
        if (n !== run.current) return;
        setPreview(p);
        setBusy(false);
        if (p.ok) {
          setChoice((c) => (c !== "both" && p.tees.includes(c) ? c : p.tee));
          setTitle((t) => t || p.title);
          track("upload_preview", { class: p.cls, tier: p.tier });
        } else track("upload_refused", { reason: p.code });
      });
  }, [source, mode, size]);

  const choose = useCallback(async (file: File) => {
    setStartError(null);
    setPreview(null);
    setStep("b");
    setRights(false);
    setTitle("");
    const c = await loadClient();
    const p = await c.prepare(file);
    if (!p.ok) {
      setStartError(p.reason);
      track("upload_refused", { reason: p.code });
      return;
    }
    track("upload_start", { kind: p.value.kind });
    setSource(p.value);
  }, []);

  const setWordsSource = async () => {
    const lines = words.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    const c = await loadClient();
    const p = await c.prepareWords(lines);
    if (!p.ok) return setStartError(p.reason);
    setStartError(null);
    setTitle("");
    track("upload_start", { kind: "words" });
    setSource(p.value);
  };

  const ok = preview?.ok ? preview : null;
  const shown: BaseColor = choice === "both" ? (ok?.tee ?? "white") : choice;
  const canvas = useMemo(() => (ok ? ok.canvas(shown) : null), [ok, shown]);
  const blank = useMemo(() => (hydrated ? emptyCanvas(shown) : null), [hydrated, shown]);
  const both = !!ok && ok.tees.length === 2;
  const size$ = teeSize ?? selected;
  const price = choice === "both" ? STORE_POLICY.customPairPrice : STORE_POLICY.customPrice;

  const saveTitle = async (t: string) => {
    const v = t.trim();
    const lex = await import("@/lib/custom/lexicon");
    const problem = v.length < 3 || v.length > 40 ? "A title of 3 to 40 characters." : lex.wordsProblem(v);
    setTitleError(problem);
    if (!problem) {
      setTitle(v);
      setTitleEdit(false);
    }
  };

  const add = async () => {
    if (!ok || !source) return;
    if (!size$) return setNudge((x) => x + 1);
    const c = await loadClient();
    const id = await c.keep(source, ok, { title, size, tees: choice === "both" ? ok.tees : [choice, ...ok.tees.filter((t) => t !== choice)] });
    const ref = { id, mode: ok.mode, size, hash: ok.hash };
    // Edit replaces the line it came from.
    if (editId) {
      const cart = useCartStore.getState().cart;
      useCartStore.setState({ cart: cart.filter((l) => l.upload?.id !== editId) });
    }
    const store = useCartStore.getState();
    const done = choice === "both" ? store.addPair(YOURS_ID, size$, { upload: ref, source: "product" }) : store.addToCart(YOURS_ID, size$, choice, 1, { upload: ref, source: "product" });
    if (done) {
      useTasteStore.getState().likeUpload(id, ok.measured);
      if (editId) router.push("/cart/");
    }
  };

  // "Upload another" for a refused file: once this one passes, it takes the refused one's place in the order.
  const resubmit = async () => {
    if (!ok || !source || !replaceId) return;
    const old = useMakeStore.getState().reviews[replaceId];
    if (!old) return;
    const c = await loadClient();
    const id = await c.keep(source, ok, { title, size, tees: [shown] });
    useMakeStore.getState().submitReviews(old.order, [id], { [id]: replaceId });
    router.push("/me/");
  };

  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 pt-4 md:grid-cols-2 md:gap-10">
        {/* The picture, always at the top. */}
        <div className="md:sticky md:top-4 md:self-start">
          {ok && (
            <div className="mb-2 flex min-h-8 items-center">
              {titleEdit ? (
                <form
                  className="w-full"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveTitle(new FormData(e.currentTarget).get("title") as string);
                  }}
                >
                  <input name="title" defaultValue={title} maxLength={40} autoFocus aria-label="Title" onBlur={(e) => void saveTitle(e.target.value)} className="h-9 w-full rounded-lg bg-white/[0.06] px-2 text-lg font-bold text-white ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-white" />
                  {titleError && <p className="mt-1 text-xs text-neutral-300">{titleError}</p>}
                </form>
              ) : (
                <button type="button" onClick={() => setTitleEdit(true)} className="truncate text-left text-lg font-bold" aria-label={`Title: ${title}. Edit`} data-title>
                  {title}
                </button>
              )}
            </div>
          )}
          <div className={`relative overflow-hidden rounded-3xl ${STAGE_BG}`} data-upload-preview={busy ? "busy" : ok ? "ready" : "empty"}>
            {canvas ? (
              <CustomMockup shirt={shirt} svg={canvas} color={shown} className="w-full" label={title || "Your file"} />
            ) : blank ? (
              <CustomMockup shirt={shirt} svg={blank} color={shown} className="w-full" label="A blank tee" />
            ) : (
              <div className="aspect-[512/704] w-full" />
            )}
            {busy && <p className="absolute inset-x-0 bottom-3 text-center text-xs text-neutral-300">Converting…</p>}
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">From yours</h1>
            <p className="mt-1 text-sm text-neutral-400">Your picture or words, in one ink.</p>
          </div>

          {/* A · Start */}
          <section aria-label="Start" className="space-y-3">
            <p className="text-sm text-neutral-300">A picture, a drawing or words. PNG, JPG, WebP or SVG.</p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void choose(f);
              }}
              className={`rounded-2xl p-1 transition ${drag ? "ring-2 ring-white" : ""}`}
            >
              <input
                ref={fileInput}
                id="upload-file"
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void choose(f);
                  e.target.value = "";
                }}
              />
              <label htmlFor="upload-file" className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-white text-sm font-bold text-black focus-within:ring-2 focus-within:ring-white">
                {source && source.kind !== "words" ? "Choose another file" : "Choose a file"}
              </label>
            </div>
            {!writing ? (
              <button type="button" onClick={() => setWriting(true)} className="text-sm text-neutral-400 underline underline-offset-2 hover:text-white">
                Write words instead
              </button>
            ) : (
              <div className="space-y-2">
                <label htmlFor="upload-words" className="text-xs font-medium text-neutral-400">
                  Your words <span className="text-neutral-500">up to 3 lines of 24</span>
                </label>
                <textarea
                  id="upload-words"
                  value={words}
                  rows={3}
                  onChange={(e) => setWords(e.target.value.split("\n").slice(0, WORDS_LINES).map((l) => l.slice(0, WORDS_CHARS)).join("\n"))}
                  className="w-full resize-none rounded-xl bg-white/[0.06] px-3 py-2 font-mono text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white"
                />
                <button type="button" onClick={() => void setWordsSource()} disabled={!words.trim()} className="h-10 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/30 disabled:opacity-40">
                  Set these words
                </button>
              </div>
            )}
            {startError && (
              <p role="alert" className="text-sm text-neutral-200" data-upload-error>
                {startError}
              </p>
            )}
          </section>

          {/* B · Preview */}
          {preview && (
            <section aria-label="Preview" className="space-y-4">
              {preview.cls === "photo" && <Segment label="Style" options={["dots", "lines"] as const} value={mode} onChange={setMode} format={(x) => (x === "dots" ? "Dots" : "Lines")} />}
              <Segment label="Print size" options={["full", "small"] as const} value={size} onChange={setPrintSize} format={(x) => (x === "full" ? "Full" : "Small")} />
              {ok && <TeeRadio value={choice} tees={ok.tees} both={both} onChange={setChoice} />}
              <p className="text-sm text-neutral-300" data-upload-line>
                {preview.ok ? preview.line : preview.reason}
              </p>
              {step === "b" && (
                <button type="button" disabled={!ok || busy} onClick={() => setStep("c")} className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black disabled:opacity-40">
                  Continue
                </button>
              )}
            </section>
          )}

          {/* C · Rights */}
          {ok && step !== "b" && (
            <section aria-label="Rights" className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-200">
                <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-white" />I made this, or I have permission to print it. Anyone shown in it has agreed.
              </label>
              <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="text-sm">
                <summary className="cursor-pointer text-neutral-400 hover:text-white">What we won&rsquo;t print ›</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-400">
                  {WONT_PRINT.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </details>
              {step === "c" && (
                <button type="button" disabled={!rights} onClick={() => setStep("d")} className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black disabled:opacity-40">
                  Continue
                </button>
              )}
            </section>
          )}

          {/* D · Size → bag (or, for a refused file's replacement, straight to the check) */}
          {ok && step === "d" && rights && (
            <section aria-label="Size" className="space-y-3">
              {replaceId ? (
                <button type="button" onClick={() => void resubmit()} className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black">
                  Send it for checking
                </button>
              ) : (
                <>
                  <SizeSelector key={nudge} value={size$} onChange={setTeeSize} highlight={nudge > 0 && !size$} />
                  <p className="text-sm text-neutral-400">Checked before printing. Up to 2 days.</p>
                  <button type="button" onClick={() => void add()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black">
                    {size$ ? `Add to bag · ${SIZE_LABELS[size$]} · ${formatPrice(price)}` : "Choose size"}
                  </button>
                  <p className="text-center text-xs text-neutral-500">{STORE_POLICY.customReturns}</p>
                </>
              )}
            </section>
          )}

          <p className="text-xs text-neutral-500">
            Converted on this device; the file stays here.{" "}
            <Link href="/make/" className="underline underline-offset-2 hover:text-white">
              Or make one of ours
            </Link>
            <Icon name="arrow-right" className="ml-0.5 inline h-3 w-3" />
          </p>
        </div>
      </div>
    </div>
  );
}

/** A plain tee's print: nothing inked. */
function emptyCanvas(tee: BaseColor): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 30;
  c.height = 40;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = tee === "black" ? "#000" : "#fff";
  ctx.fillRect(0, 0, 30, 40);
  return c;
}

function Segment<T extends string>({ label, options, value, onChange, format }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; format: (v: T) => string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400" id={`seg-${label}`}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`seg-${label}`} className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
            className={`h-10 rounded-full px-4 text-sm font-semibold ring-1 transition ${o === value ? "bg-white text-black ring-white" : "text-neutral-300 ring-white/15 hover:bg-white/10"}`}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The tee: pre-chosen by the tee rule; a tee the print can't carry is disabled, and Both only when both pass. */
function TeeRadio({ value, tees, both, onChange }: { value: Choice; tees: BaseColor[]; both: boolean; onChange: (c: Choice) => void }) {
  const opts: { c: Choice; label: string; off: boolean }[] = [
    { c: "black", label: "Black", off: !tees.includes("black") },
    { c: "white", label: "White", off: !tees.includes("white") },
    { c: "both", label: `Both · ${formatPrice(STORE_POLICY.customPairPrice)}`, off: !both },
  ];
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400" id="seg-tee">
        Tee
      </p>
      <div role="radiogroup" aria-labelledby="seg-tee" className="flex flex-wrap gap-1.5">
        {opts.map(({ c, label, off }) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            disabled={off}
            onClick={() => onChange(c)}
            className={`h-10 rounded-full px-4 text-sm font-semibold ring-1 transition disabled:opacity-30 ${value === c ? "bg-white text-black ring-white" : "text-neutral-300 ring-white/15 hover:bg-white/10"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
