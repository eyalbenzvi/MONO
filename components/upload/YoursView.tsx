"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MakeHeader } from "@/components/custom/MakeHeader";
import { Icon } from "@/components/Icon";
import { SizeSelector, STAGE_BG } from "@/components/ui";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { track } from "@/lib/analytics";
import { assetUrl, getShirtById, productHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { STORE_POLICY } from "@/lib/store-policy";
import { YOURS_ID } from "@/lib/upload/keys";
import { WONT_PRINT } from "@/lib/upload/review";
import type { Fix, Preview, PreviewFail, PreviewOk, Settings, Source } from "@/lib/upload/client";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { FORCE_KEY, useMakeStore } from "@/store/makeStore";
import { useHydrated } from "@/store/useUiStore";
import { SIZE_LABELS, type ShirtSize } from "@/types/shirt";
const EditPhoto = lazy(() => import("./yours/EditPhoto").then((m) => ({ default: m.EditPhoto })));
import { ChoiceThumbs, type Choice } from "./yours/ChoiceThumbs";
import { Stage, placeholder, type StageState } from "./yours/Stage";

type Step = "start" | "print" | "rights" | "size";
const STEPS: Step[] = ["start", "print", "rights", "size"];
const loadClient = () => import("@/lib/upload/client");
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.svg";
const stepOf = (hash: string): Step => (STEPS.includes(hash.slice(1) as Step) ? (hash.slice(1) as Step) : "start");
const WORDS_LINES = 3;
const WORDS_CHARS = 24;

/**
 * From yours (/make/yours/): your picture, drawing or words, in one ink.
 * Four steps, one white button each, the picture always in view: Start
 * (what do you have?), Your print (Dots or Lines, Full or Small, the tee,
 * each shown as the real result; a print that fails shows itself and the
 * fixes that pass), Rights, Size. The step is in the address's hash, so a
 * phone's Back walks back through them; the file in hand is kept on the
 * device as a draft, so a reload comes back to it. Everything is converted
 * and checked on this device.
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

  const [step, setStep] = useState<Step>("start");
  const [source, setSource] = useState<Source | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [last, setLast] = useState<PreviewOk | null>(null);
  const [busy, setBusy] = useState(false);
  const [fixes, setFixes] = useState<{ fix: Fix; settings: Settings; preview: PreviewOk }[] | null>(null);
  const [choice, setChoice] = useState<Choice>("white");
  const [title, setTitle] = useState("");
  const [rightsFor, setRightsFor] = useState<string | null>(null);
  const [teeSize, setTeeSize] = useState<ShirtSize | undefined>(undefined);
  const [startError, setStartError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [wordsMode, setWordsMode] = useState(false);
  const [words, setWords] = useState("");
  const [wordsError, setWordsError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [nudge, setNudge] = useState(0);
  const [added, setAdded] = useState(false);
  const selected = useCartStore((s) => sizeFor(s, YOURS_ID));
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const run = useRef(0);
  const entered = useRef(Date.now());

  /* ---------------- steps and history ---------------- */
  const go = useCallback((next: Step, replace = false) => {
    const url = `${window.location.pathname}${window.location.search}${next === "start" ? "" : `#${next}`}`;
    if (replace) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState(window.history.state, "", url);
    setStep(next);
  }, []);
  useEffect(() => {
    const on = () => setStep(stepOf(window.location.hash));
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  useEffect(() => {
    heading.current?.focus();
    const secs = Math.round((Date.now() - entered.current) / 1000);
    entered.current = Date.now();
    track("yours_step", { n: STEPS.indexOf(step) + 1, secs_bucket: secs < 10 ? "<10" : secs < 30 ? "<30" : secs < 90 ? "<90" : "90+" });
  }, [step]);

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

  /* ---------------- arrival: edit, draft ---------------- */
  useEffect(() => {
    if (!hydrated) return;
    track("yours_view", { from: editId ? "edit" : replaceId ? "replace" : "make" });
    const want = stepOf(window.location.hash);
    void loadClient().then(async (c) => {
      if (editId) {
        const r = await c.reopen(editId);
        if (r) {
          const meta = useMakeStore.getState().uploads[editId];
          setSource(r.source);
          setSettings(r.settings);
          if (r.source.kind === "words") (setWordsMode(true), setWords(r.source.words!.join("\n")));
          // The tee as it is in the bag: both colours when the line was the pair.
          const lines = useCartStore.getState().cart.filter((l) => l.upload?.id === editId);
          if (meta) setTitle(meta.title);
          setChoice(lines.length >= 2 ? "both" : (lines[0]?.color ?? meta?.tees[0] ?? "white"));
          setRightsFor(`${r.source.id}|${JSON.stringify([r.settings.crop, r.settings.rot, ...(r.settings.flip ? [true] : [])])}`);
          go("print", true);
          return;
        }
      }
      const d = await c.reopen(c.DRAFT);
      if (d) {
        setDraftName(d.name);
        if (want !== "start") {
          setSource(d.source);
          setSettings(d.settings);
          if (d.source.kind === "words") (setWordsMode(true), setWords(d.source.words!.join("\n")));
          // Back where it was (Size asks the rights again: they aren't kept with the draft).
          if (want === "size") go("rights", true);
          else setStep(want);
          return;
        }
      }
      if (want !== "start") go("start", true);
    });
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const carryOn = async () => {
    const c = await loadClient();
    const d = await c.reopen(c.DRAFT);
    if (!d) return setDraftName(null);
    setSource(d.source);
    setSettings(d.settings);
    if (d.source.kind === "words") (setWordsMode(true), setWords(d.source.words!.join("\n")));
    go("print");
  };

  /* ---------------- opening a file or words ---------------- */
  const choose = useCallback(
    async (file: File, kind: string) => {
      setStartError(null);
      setOpening(kind);
      const c = await loadClient();
      const r = await c.openFile(file);
      setOpening(null);
      if (!r.ok) {
        setStartError(r.reason);
        track("upload_refused", { reason: r.code });
        return;
      }
      track("upload_start", { kind: r.source.kind === "svg" ? "svg" : kind });
      setWordsMode(false);
      setSource(r.source);
      setSettings({ ...c.DEFAULTS });
      setPreview(null);
      setLast(null);
      setTitle("");
      setRightsFor(null);
      void c.saveDraft(r.source, c.DEFAULTS);
      go("print");
    },
    [go],
  );
  const [tile, setTile] = useState("photo");
  const pick = (kind: string) => {
    setTile(kind);
    track("yours_start_tile", { kind });
    // A link is Your Link's own page (a QR code drawn from the address, not a file).
    if (kind === "link") return router.push("/make/qr/");
    if (kind === "words") {
      setWordsMode(true);
      setSource(null);
      setPreview(null);
      setLast(null);
      setTitle("");
      setRightsFor(null);
      void loadClient().then((c) => setSettings({ ...c.DEFAULTS }));
      go("print");
      return;
    }
    fileInput.current?.click();
  };

  // Words: set as you type (a pause of 300 ms), no button.
  useEffect(() => {
    if (!wordsMode) return;
    const lines = words.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) {
      setSource(null);
      setPreview(null);
      setWordsError(null);
      return;
    }
    const t = setTimeout(async () => {
      const c = await loadClient();
      const id = `w${[...lines.join("\n")].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0), 2166136261).toString(36)}`;
      const r = await c.openWords(lines, id);
      if (!r.ok) {
        setWordsError(r.reason);
        return;
      }
      setWordsError(null);
      setSource(r.source);
      if (!rightsFor) track("upload_start", { kind: "words" });
      void c.saveDraft(r.source, settings ?? c.DEFAULTS);
    }, 300);
    return () => clearTimeout(t);
    // Settings don't reopen the words.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, wordsMode]);

  /* ---------------- converting ---------------- */
  useEffect(() => {
    if (!source || !settings) return;
    const n = ++run.current;
    setBusy(true);
    setFixes(null);
    setStatus(last ? "" : "Converting");
    void loadClient().then(async (c) => {
      const p = await c.convertWith(source, settings);
      if (n !== run.current) return;
      setPreview(p);
      setBusy(false);
      if (p.ok) {
        setLast(p);
        setChoice((ch) => (ch === "both" ? (p.tees.length === 2 ? "both" : p.tee) : p.tees.includes(ch) ? ch : p.tee));
        setTitle((t) => t || p.title);
        setStatus(p.autoSmall ? "Big enough for Small, not Full. We've set Small." : `It prints on ${p.tee}.`);
        track("upload_preview", { class: p.cls, tier: p.tier });
        return;
      }
      setStatus(p.reason);
      track("upload_refused", { reason: p.code });
      const found = p.duplicateOf ? [] : await c.passingFixes(source, settings, p);
      if (n !== run.current) return;
      setFixes(found);
      track("upload_fix_offered", { reason: p.code, n: found.length });
    });
    if (source.kind !== "words") void loadClient().then((c) => c.saveDraft(source, settings));
    // `last` is only read for the status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, settings]);

  const patch = (p: Partial<Settings>) => settings && setSettings({ ...settings, ...p });
  const applyFix = (f: { fix: Fix; settings: Settings; preview: PreviewOk }) => {
    setSettings(f.settings);
    track("upload_fix_applied", { reason: (preview as PreviewFail | null)?.code ?? "", fix: f.fix.id, passed: true });
    setStatus(`${f.fix.label.replace(/^Use /, "Now ")}. It prints.`);
  };

  /* ---------------- what the stage shows ---------------- */
  const ok = preview?.ok ? preview : null;
  const failed = preview && !preview.ok ? preview : null;
  const tee = choice === "both" ? (ok?.tee ?? last?.tee ?? "white") : choice;
  const stageState: StageState = useMemo(() => {
    if (wordsMode && !source) return { kind: "empty-words" };
    if (busy) {
      const c = last?.canvas(last.tees.includes(tee) ? tee : last.tee) ?? (source && settings && source.bitmap ? placeholder(source, settings, tee) : null);
      return c ? { kind: "converting", canvas: c } : { kind: "empty-words" };
    }
    if (ok) return { kind: "ready", canvas: ok.canvas(ok.tees.includes(tee) ? tee : ok.tee)! };
    if (failed) return { kind: "failed", canvas: failed.tee ? failed.canvas(failed.tee) : source && settings && source.bitmap ? placeholder(source, settings, tee) : null };
    return source && settings && source.bitmap ? { kind: "converting", canvas: placeholder(source, settings, tee) } : { kind: "empty-words" };
  }, [wordsMode, source, busy, last, tee, settings, ok, failed]);
  const pill = busy ? (last ? "Checking it prints…" : "Converting…") : undefined;
  const price = choice === "both" ? STORE_POLICY.customPairPrice : STORE_POLICY.customPrice;
  const size$ = teeSize ?? selected;
  // The rights are asked of the picture as it will print: a new crop, turn or mirror asks again (light and contrast don't change what's in it).
  const rightsKey = source && settings ? `${source.id}|${JSON.stringify([settings.crop, settings.rot, ...(settings.flip ? [true] : [])])}` : null;

  /* ---------------- the primary button of each step ---------------- */
  const toRights = () => {
    if (!ok) return;
    go(rightsFor === rightsKey ? "size" : "rights");
  };
  const confirm = () => {
    setRightsFor(rightsKey);
    track("upload_rights_confirm");
    if (replaceId) void resubmit();
    else go("size");
  };
  const add = async () => {
    if (!ok || !source || !settings) return;
    if (!size$) return setNudge((x) => x + 1);
    const c = await loadClient();
    const tees = choice === "both" ? ok.tees : [choice as "black" | "white", ...ok.tees.filter((t) => t !== choice)];
    const id = await c.keep(source, ok, { title, tees, settings: { ...settings, size: ok.size } });
    const ref = { id, mode: ok.mode, size: ok.size, hash: ok.hash };
    if (editId) useCartStore.setState((s) => ({ cart: s.cart.filter((l) => l.upload?.id !== editId) }));
    const store = useCartStore.getState();
    const done = choice === "both" ? store.addPair(YOURS_ID, size$, { upload: ref, source: "product" }) : store.addToCart(YOURS_ID, size$, choice, 1, { upload: ref, source: "product" });
    if (!done) return;
    void import("@/store/tasteStore").then((m) => m.useTasteStore.getState().likeUpload(id, ok.measured));
    void c.clearDraft();
    setDraftName(null);
    setAdded(true);
    if (editId) router.push("/cart/");
  };
  // "Upload another" for a refused file: once this one passes, it takes the refused one's place in the order.
  const resubmit = async () => {
    if (!ok || !source || !settings || !replaceId) return;
    const old = useMakeStore.getState().reviews[replaceId];
    if (!old) return;
    const c = await loadClient();
    const id = await c.keep(source, ok, { title, tees: [tee], settings: { ...settings, size: ok.size } });
    useMakeStore.getState().submitReviews(old.order, [id], { [id]: replaceId });
    void c.clearDraft();
    track("upload_another");
    router.push("/me/");
  };

  const firstFix = fixes?.[0];
  const primary: { label: string; onClick?: () => void; href?: string; disabled?: boolean } | null =
    step === "print"
      ? ok && !busy
        ? { label: `Looks good · ${formatPrice(price)}`, onClick: toRights }
        : failed && !busy
          ? failed.duplicateOf
            ? { label: "See it in the shop", href: productHref(failed.duplicateOf) }
            : fixes === null
              ? { label: "Finding a fix…", disabled: true }
              : firstFix
                ? { label: firstFix.fix.label, onClick: () => applyFix(firstFix) }
                : { label: "Choose another file", onClick: () => fileInput.current?.click() }
          : { label: `Looks good · ${formatPrice(price)}`, disabled: true }
      : step === "rights"
        ? { label: replaceId ? "Send it for checking" : "I confirm", onClick: confirm }
        : step === "size"
          ? added
            ? { label: "Added · View bag", href: "/cart/" }
            : { label: size$ ? `${editId ? "Save changes" : "Add to bag"} · ${SIZE_LABELS[size$]} · ${formatPrice(price)}` : "Choose size", onClick: () => void add() }
          : null;

  const back: Record<Step, string> = { start: "", print: "Start", rights: "Your print", size: "Rights" };
  const titles: Record<Step, string> = { start: "What do you have?", print: "Your print", rights: "Rights", size: "Size" };

  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <input
        ref={fileInput}
        id="upload-file"
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choose(f, tile);
          e.target.value = "";
        }}
      />
      {step === "start" ? (
        <Start
          heading={heading}
          onPick={pick}
          opening={opening}
          error={startError}
          draftName={draftName}
          onCarryOn={carryOn}
          replacing={replaceId ? useMakeStore.getState().reviews[replaceId] : undefined}
          onDrop={(f) => void choose(f, "photo")}
        />
      ) : (
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-1 md:pb-12 2xl:max-w-6xl">
          <div className="mb-2 flex h-11 items-center justify-between">
            <button type="button" onClick={() => window.history.back()} className="inline-flex h-10 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
              <Icon name="arrow-left" className="h-4 w-4" /> {back[step]}
            </button>
            <h2 ref={heading} tabIndex={-1} className="text-sm text-neutral-400 outline-none" data-step={step}>
              {titles[step]}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 md:gap-10">
            <div className="md:sticky md:top-4 md:self-start">
              <Stage shirt={shirt} tee={tee} state={stageState} source={source} pill={pill} label={title || "Your print"} />
              <p aria-live="polite" className="sr-only" data-upload-status>
                {status}
              </p>
            </div>
            <div className="space-y-6">
              {step === "print" && settings && (
                <PrintStep
                  wordsMode={wordsMode}
                  words={words}
                  setWords={setWords}
                  wordsError={wordsError}
                  source={source}
                  settings={settings}
                  preview={preview}
                  ok={ok}
                  failed={failed}
                  busy={busy}
                  fixes={fixes}
                  choice={choice}
                  setChoice={setChoice}
                  patch={patch}
                  shirt={shirt}
                  status={status}
                  onFix={applyFix}
                  onEdit={() => setEditing(true)}
                  onAnother={() => fileInput.current?.click()}
                />
              )}
              {step === "rights" && <RightsStep />}
              {step === "size" && ok && settings && (
                <SizeStep
                  title={title}
                  setTitle={setTitle}
                  summary={`${ok.mode === "dots" ? "Dots" : ok.mode === "lines" ? "Lines" : ok.cls === "words" ? "Words" : ok.cls === "vector" ? "Line" : "Drawing"} · ${ok.size === "full" ? "Full" : "Small"} · ${choice === "both" ? "Both tees" : `${choice === "black" ? "Black" : "White"} tee`}`}
                  onChange={() => window.history.go(-2)}
                  size={size$}
                  setSize={(s) => (setTeeSize(s), useCartStore.getState().setSize(YOURS_ID, s))}
                  nudge={nudge}
                />
              )}
              {primary && <PrimaryBar {...primary} />}
            </div>
          </div>
        </div>
      )}
      {editing && source && settings && (
        <Suspense fallback={null}>
          <EditPhoto
            source={source}
            settings={settings}
            onClose={() => setEditing(false)}
            onSave={(p) => {
              setEditing(false);
              // Which edits the saved picture carries (never the picture), for what gets used.
              const what = (["crop", "rot", "flip", "light", "contrast", "stronger"] as const).filter((k) => !!p[k]);
              track("upload_edit", { what: what.join(".") || "reset" });
              patch(p);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/* ================================================================== */

function Start({
  heading,
  onPick,
  opening,
  error,
  draftName,
  onCarryOn,
  replacing,
  onDrop,
}: {
  heading: React.RefObject<HTMLHeadingElement>;
  onPick: (kind: string) => void;
  opening: string | null;
  error: string | null;
  draftName: string | null;
  onCarryOn: () => void;
  replacing?: { order: string };
  onDrop: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const TILES = [
    // One tile for a photo or a drawing: the converter tells them apart by itself, and a drawing shot on paper has its own style (Drawing).
    { kind: "photo", label: "A photo or drawing", line: "A pet, a place, a sketch on paper. JPG, PNG, WebP or SVG." },
    { kind: "words", label: "Words", line: "Up to three lines, in our type." },
    { kind: "link", label: "A link", line: "A web address, as a QR code that scans." },
  ];
  return (
    <div
      className={`mx-auto max-w-5xl px-4 pb-12 pt-4 2xl:max-w-6xl ${drag ? "ring-2 ring-inset ring-white" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
      }}
    >
      <MakeHeader track="yours" />
      {replacing && <p className="mt-6 rounded-2xl bg-white/[0.05] p-3 text-sm text-neutral-200 ring-1 ring-white/10">Replacing a file from order {replacing.order}. Once this one passes, it takes that one&rsquo;s place.</p>}
      {draftName && (
        <button type="button" onClick={onCarryOn} className="mt-6 flex h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-sm text-neutral-200 ring-1 ring-white/15 hover:bg-white/[0.05]" data-draft>
          <span className="truncate">Carry on with {draftName}</span>
          <Icon name="arrow-right" className="h-4 w-4 shrink-0" />
        </button>
      )}
      <h2 ref={heading} tabIndex={-1} className="mt-8 text-lg font-bold outline-none">
        What do you have?
      </h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <li key={t.kind}>
            <button
              type="button"
              onClick={() => onPick(t.kind)}
              data-tile={t.kind}
              className="group flex w-full items-stretch gap-4 overflow-hidden rounded-2xl text-left ring-1 ring-white/10 transition hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-white md:flex-col md:gap-0"
            >
              {/* The real converter's work: the input, and the print it made, framed alike (3:4, the same crop) and never stretched with the text. */}
              <div className={`grid w-40 shrink-0 grid-cols-2 gap-px self-start md:w-full ${STAGE_BG}`} aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(`/make/yours/${t.kind}-before.webp`)} alt="" width={360} height={480} className="block aspect-[3/4] w-full object-cover" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(`/make/yours/${t.kind}-after.webp`)} alt="" width={360} height={480} className="block aspect-[3/4] w-full object-cover" />
              </div>
              <div className="flex flex-col justify-center py-3 pr-3 md:p-4">
                <span className="text-base font-bold">{opening === t.kind ? "Opening…" : t.label}</span>
                <span className="mt-1 text-sm text-neutral-400">{t.line}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-4 text-sm text-neutral-200" data-upload-error>
          {error}
        </p>
      )}
    </div>
  );
}

function PrintStep({
  wordsMode,
  words,
  setWords,
  wordsError,
  source,
  settings,
  preview,
  ok,
  failed,
  busy,
  fixes,
  choice,
  setChoice,
  patch,
  shirt,
  status,
  onFix,
  onEdit,
  onAnother,
}: {
  wordsMode: boolean;
  words: string;
  setWords: (w: string) => void;
  wordsError: string | null;
  source: Source | null;
  settings: Settings;
  preview: Preview | null;
  ok: PreviewOk | null;
  failed: PreviewFail | null;
  busy: boolean;
  fixes: { fix: Fix; settings: Settings; preview: PreviewOk }[] | null;
  choice: Choice;
  setChoice: (c: Choice) => void;
  patch: (p: Partial<Settings>) => void;
  shirt: NonNullable<ReturnType<typeof getShirtById>>;
  status: string;
  onFix: (f: { fix: Fix; settings: Settings; preview: PreviewOk }) => void;
  onEdit: () => void;
  onAnother: () => void;
}) {
  const [meaning, setMeaning] = useState<Record<string, string>>({});
  const [cropFix, setCropFix] = useState(false);
  useEffect(() => {
    if (!failed || !source) return setCropFix(false);
    void loadClient().then((c) => {
      setMeaning(c.MEANING);
      setCropFix(c.fixesFor(failed, settings, source).some((f) => f.id === "crop"));
    });
  }, [failed, source, settings]);
  const caretLine = words.split("\n").at(-1) ?? "";
  return (
    <>
      {wordsMode && (
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs font-medium text-neutral-400">
            <label htmlFor="upload-words">Your words</label>
            <span className={caretLine.length >= WORDS_CHARS ? "text-white" : ""}>
              {caretLine.length} / {WORDS_CHARS}
            </span>
          </div>
          <textarea
            id="upload-words"
            value={words}
            rows={3}
            autoFocus={!words}
            placeholder={"MODERATE\nBECOMING\nGOOD"}
            onChange={(e) => setWords(e.target.value.split("\n").slice(0, WORDS_LINES).map((l) => l.slice(0, WORDS_CHARS)).join("\n"))}
            className="w-full resize-none rounded-xl bg-white/[0.06] px-3 py-2 font-mono text-base text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white"
          />
          {wordsError && (
            <p role="status" className="mt-1 text-xs text-neutral-300" data-words-error>
              {wordsError}
            </p>
          )}
        </div>
      )}
      {ok?.autoSmall && <p className="text-sm text-neutral-300">Big enough for Small, not Full. We&rsquo;ve set Small.</p>}
      {source && (ok ?? null) && <ChoiceThumbs shirt={shirt} source={source} settings={settings} preview={ok!} choice={choice} onSettings={patch} onChoice={setChoice} />}
      {ok && (
        <p className="text-sm text-neutral-300" data-upload-line>
          {ok.line}
        </p>
      )}
      {failed && !busy && (
        <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" data-fix-card>
          <p className="text-sm font-semibold text-white" data-upload-line>
            {failed.reason}
          </p>
          {meaning[failed.code] && <p className="mt-1 text-sm text-neutral-400">{meaning[failed.code]}</p>}
          {fixes === null && !failed.duplicateOf && <p className="mt-3 text-xs text-neutral-400">Finding a fix…</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {(fixes ?? []).slice(1).map((f) => (
              <button key={f.fix.id} type="button" onClick={() => onFix(f)} className="h-11 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10" data-fix={f.fix.id}>
                {f.fix.label}
              </button>
            ))}
            {cropFix && (
              <button type="button" onClick={onEdit} className="h-11 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10" data-fix="crop">
                Crop tighter
              </button>
            )}
          </div>
          {fixes?.[0] && (
            <p className="mt-2 text-xs text-neutral-500" data-first-fix={fixes[0].fix.id}>
              {fixes[0].fix.label} fixes it (the button below).
            </p>
          )}
        </div>
      )}
      {preview === null && !wordsMode && <p className="text-sm text-neutral-400">{status || "Converting…"}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {source && source.kind === "file" && (
          <button type="button" onClick={onEdit} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/10" data-edit-photo>
            <Icon name="pencil" className="h-4 w-4" /> Edit photo
          </button>
        )}
        {!wordsMode && (
          <button type="button" onClick={onAnother} className="h-10 text-sm text-neutral-300 underline underline-offset-4 hover:text-white">
            Choose another file
          </button>
        )}
      </div>
    </>
  );
}

function RightsStep() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-base text-neutral-100">I made this, or I have permission. Anyone in it has agreed.</p>
      <button type="button" onClick={() => setOpen(true)} className="h-10 text-sm text-neutral-300 underline underline-offset-4 hover:text-white">
        What we won&rsquo;t print
      </button>
      {open && <WontPrint onClose={() => setOpen(false)} />}
    </div>
  );
}

function WontPrint({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="wont-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-ink-900 p-5 ring-1 ring-white/10 md:rounded-3xl">
        <h2 id="wont-title" className="text-base font-bold">
          What we won&rsquo;t print
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
          {WONT_PRINT.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <button type="button" data-autofocus onClick={onClose} className="mt-5 flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold text-white ring-1 ring-white/30">
          Close
        </button>
      </div>
    </div>
  );
}

function SizeStep({ title, setTitle, summary, onChange, size, setSize, nudge }: { title: string; setTitle: (t: string) => void; summary: string; onChange: () => void; size?: ShirtSize; setSize: (s: ShirtSize) => void; nudge: number }) {
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const save = async (v: string) => {
    const t = v.trim();
    const lex = await import("@/lib/custom/lexicon");
    const problem = t.length < 3 || t.length > 40 ? "A title of 3 to 40 characters." : lex.wordsProblem(t);
    setError(problem);
    if (!problem) setTitle(t);
  };
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="upload-title" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-400">
          <Icon name="pencil" className="h-3.5 w-3.5" /> Title
        </label>
        <input
          id="upload-title"
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => void save(e.target.value)}
          aria-invalid={!!error}
          className="h-11 w-full rounded-xl bg-white/[0.06] px-3 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white"
          data-title
        />
        {error && <p className="mt-1 text-xs text-neutral-300">{error}</p>}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-neutral-300" data-summary>
        {summary}
        <button type="button" onClick={onChange} className="h-10 text-neutral-400 underline underline-offset-4 hover:text-white">
          Change
        </button>
      </p>
      <SizeSelector key={nudge} value={size} onChange={setSize} highlight={nudge > 0 && !size} />
      <p className="text-sm text-neutral-400">Checked by a person before printing. Up to 2 days. Nothing charged if we can&rsquo;t print it.</p>
      <p className="text-xs text-neutral-500">{STORE_POLICY.customReturns}</p>
    </div>
  );
}

/** The step's one white button: in the flow on desktop, a bar at the foot of the screen on a phone. */
function PrimaryBar({ label, onClick, href, disabled }: { label: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const cls = "flex h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-40";
  const button = href ? (
    <Link href={href} className={cls} data-primary>
      {label}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} data-primary>
      {label}
    </button>
  );
  return <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#050505]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">{button}</div>;
}
