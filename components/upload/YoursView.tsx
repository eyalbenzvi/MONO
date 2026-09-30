"use client";

import { MAKE_PAIR_PRICE, MAKE_PRICE } from "@/lib/prices";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MakeHeader } from "@/components/custom/MakeHeader";
import { Icon } from "@/components/Icon";
import { BUTTON_PRIMARY, SizeSelector, TrustLine } from "@/components/ui";
import { useDock } from "@/hooks/useDock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { track } from "@/lib/analytics";
import { getShirtById } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { YOURS_ID } from "@/lib/upload/keys";
import { WONT_PRINT } from "@/lib/upload/review";
import type { Fix, Preview, PreviewFail, PreviewOk, Settings, Source, Tee } from "@/lib/upload/client";
import { ctaLabel, editUpload } from "@/lib/cart";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { FORCE_KEY, useMakeStore } from "@/store/makeStore";
import { scrollIntoViewQuietly, useHydrated, useUiStore } from "@/store/useUiStore";
import type { ShirtSize } from "@/types/shirt";
import { useFlash } from "@/hooks/useFlash";
import { ChoiceThumbs, type Choice } from "./yours/ChoiceThumbs";
import { Stage, placeholder, type StageState } from "./yours/Stage";

const EditPhoto = lazy(() => import("./yours/EditPhoto").then((m) => ({ default: m.EditPhoto })));

type Step = "start" | "print" | "size";
const STEPS: Step[] = ["start", "print", "size"];
const loadClient = () => import("@/lib/upload/client");
type Client = Awaited<ReturnType<typeof loadClient>>;
/** This tab has a picture in hand (the draft, saved from here): back on From yours from another page, it opens again where it was. */
const LIVE_KEY = "mono-yours-live";
const isLive = () => {
  try {
    return sessionStorage.getItem(LIVE_KEY) === "1";
  } catch {
    return false;
  }
};
const live = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(LIVE_KEY, "1");
    else sessionStorage.removeItem(LIVE_KEY);
  } catch {
    /* storage unavailable */
  }
};
const saveLive = (c: Client, src: Source, s: Settings) => (live(true), c.saveDraft(src, s));
const clearLive = (c: Client) => (live(false), c.clearDraft());
/** The status when the converter's code can't be loaded. */
const LOAD_FAILED = "Couldn’t load. Check your connection and try again.";
/** The draft is saved this long after the last change. */
const DRAFT_SAVE_MS = 500;
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.svg";
const stepOf = (hash: string): Step => (STEPS.includes(hash.slice(1) as Step) ? (hash.slice(1) as Step) : "start");

/** The quiet line for a fix applied on its own: "We’ve set Small." */
const fixNote = (f: Fix) =>
  f.id === "stronger" ? "We’ve made it stronger." : f.id === "bolder" ? "We’ve made the lines bolder." : `We’ve set ${f.label.replace(/^Use /, "")}.`;

/**
 * From yours (/make/yours/): your picture, in one ink. Two
 * screens, one white button each, the picture always in view: Your print
 * (before a file, the tee with "Your print here" on it, which opens the chooser;
 * then the style, the print size, the tee — a first print that fails takes
 * the first fix that passes, and says so) and Size (adding confirms the
 * rights). The step is in the address's hash ("" before a file, #print,
 * #size), so a phone's Back walks back through them; the file in hand is
 * kept on the device as a draft, so a reload comes back to it. Everything
 * is converted and checked on this device.
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
  const replacing = useMakeStore((s) => (replaceId ? s.reviews[replaceId] : undefined));
  const shirt = getShirtById(YOURS_ID)!;

  const [step, setStep] = useState<Step>("start");
  const [source, setSource] = useState<Source | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  /** The draft save waiting on DRAFT_SAVE_MS, if any. */
  const pendingSave = useRef<(() => void) | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [last, setLast] = useState<PreviewOk | null>(null);
  const [busy, setBusy] = useState(false);
  // The files known to be photographs (a Style to choose), kept by source: a failed print still offers its styles.
  const photos = useRef(new Set<string>());
  const [fixes, setFixes] = useState<{ fix: Fix; settings: Settings; preview: PreviewOk }[] | null>(null);
  const [choice, setChoice] = useState<Choice>("white");
  const [title, setTitle] = useState("");
  const [rightsFor, setRightsFor] = useState<string | null>(null);
  const [teeSize, setTeeSize] = useState<ShirtSize | undefined>(undefined);
  const [startError, setStartError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [drag, setDrag] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [nudge, setNudge] = useState(0);
  const [added, flashAdded] = useFlash();
  const selected = useCartStore((s) => sizeFor(s, YOURS_ID));
  const fileInput = useRef<HTMLInputElement>(null);
  const sizeRow = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const run = useRef(0);
  // The source whose first print has been seen: a first print that fails takes the first fix that passes (once, never over a choice made).
  const firstSeen = useRef<string | null>(null);
  const [autoNote, setAutoNote] = useState<string | null>(null);
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
  const firstStep = useRef(true);
  useEffect(() => {
    // A new step puts focus on its heading; the page's first load doesn't (no ring around the first question).
    if (firstStep.current) firstStep.current = false;
    else heading.current?.focus();
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

  /** A kept upload or the draft, opened again: its file and settings in hand. */
  const applyReopened = (r: { source: Source; settings: Settings }) => {
    // Its settings were chosen (a kept print, a draft): never changed for it by the first-print fix.
    firstSeen.current = r.source.id;
    setSource(r.source);
    setSettings(r.settings);
  };
  /** A new file: nothing of the last one's print, title or rights carries over. */
  const resetForNewSource = () => {
    setPreview(null);
    setLast(null);
    setTitle("");
    setRightsFor(null);
  };
  // The file replaced gives its decoded picture back (a 12 MP photo is ~48 MB until closed); a ref, so a remount's cleanup never closes the one in use.
  const shownSource = useRef<Source | null>(null);
  useEffect(() => {
    const prev = shownSource.current;
    if (prev && prev !== source && prev.bitmap && prev.bitmap !== source?.bitmap) prev.bitmap.close();
    shownSource.current = source;
  }, [source]);

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
          applyReopened(r);
          // The tee as it is in the bag: both colours when the line was the pair.
          const lines = useCartStore.getState().cart.filter((l) => l.upload?.id === editId);
          if (meta) setTitle(meta.title);
          const colours = new Set(lines.map((l) => l.color));
          setChoice(colours.size === 2 ? "both" : (lines[0]?.color ?? meta?.tees[0] ?? "white"));
          // The size is the line's (not the size last picked elsewhere); several lines keep theirs.
          if (lines[0]) setTeeSize(lines[0].size);
          setRightsFor(r.source.id);
          go("print", true);
          return;
        }
      }
      const d = await c.reopen(c.DRAFT);
      if (d) {
        setDraftName(d.name);
        // Left for another page of the site and back (this tab, the draft still in hand): straight back to it.
        if (want !== "start" || isLive()) {
          applyReopened(d);
          if (want === "start") return go("print", true);
          // Back where it was.
          setStep(want);
          return;
        }
      }
      if (want !== "start") go("start", true);
    }).catch(() => {
      // The converter didn't load: the start screen, with the reason (never a blank "Your print").
      setStartError(LOAD_FAILED);
      if (want !== "start") go("start", true);
    });
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const carryOn = async () => {
    const c = await loadClient().catch(() => null);
    if (!c) return setStartError(LOAD_FAILED);
    const d = await c.reopen(c.DRAFT);
    if (!d) return setDraftName(null);
    applyReopened(d);
    go("print");
  };

  /* ---------------- opening a file ---------------- */
  // Two files picked quickly: only the last one opened counts.
  const opened = useRef(0);
  const choose = useCallback(
    async (file: File) => {
      const n = ++opened.current;
      setStartError(null);
      setOpening(true);
      let c: Awaited<ReturnType<typeof loadClient>>;
      let r: Awaited<ReturnType<typeof c.openFile>>;
      try {
        c = await loadClient();
        r = await c.openFile(file);
      } catch {
        // The converter didn't load (a dropped connection): the button comes back, with the reason.
        if (n !== opened.current) return;
        setOpening(false);
        setStartError(LOAD_FAILED);
        return;
      }
      if (n !== opened.current) return;
      setOpening(false);
      if (!r.ok) {
        setStartError(r.reason);
        track("upload_refused", { reason: r.code });
        return;
      }
      track("upload_start", { kind: r.source.kind === "svg" ? "svg" : "photo" });
      setSource(r.source);
      setSettings({ ...c.DEFAULTS });
      resetForNewSource();
      if (!editId) saveLive(c, r.source, c.DEFAULTS);
      go("print");
    },
    // resetForNewSource only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [go],
  );
  const pickFile = () => {
    track("yours_start_tile", { kind: "photo" });
    fileInput.current?.click();
  };

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
      const first = firstSeen.current !== source.id;
      firstSeen.current = source.id;
      if (first) setAutoNote(null);
      if (p.cls === "photo") photos.current.add(source.id);
      setPreview(p);
      setBusy(false);
      if (p.ok) {
        setLast(p);
        setChoice((ch) => (ch === "both" ? (p.tees.length === 2 ? "both" : p.tee) : p.tees.includes(ch) ? ch : p.tee));
        setTitle((t) => t || p.title);
        setStatus(p.autoSmall ? "Big enough for Small, not Full. We’ve set Small." : `It prints on ${p.tee}.`);
        track("upload_preview", { class: p.cls, tier: p.tier });
        return;
      }
      setStatus(p.reason);
      track("upload_refused", { reason: p.code });
      const found = await c.passingFixes(source, settings, p);
      if (n !== run.current) return;
      if (first && found[0]) {
        // As a file too small for Full goes to Small: the first fix that passes, applied, in one quiet line.
        setAutoNote(fixNote(found[0].fix));
        setSettings(found[0].settings);
        track("upload_fix_applied", { reason: p.code, fix: found[0].fix.id, passed: true, auto: true });
        return;
      }
      setFixes(found);
      track("upload_fix_offered", { reason: p.code, n: found.length });
    }).catch(() => {
      // The converter didn't load (a dropped connection): never left on "Converting…".
      if (n !== run.current) return;
      setBusy(false);
      setStatus(LOAD_FAILED);
    });
    // The draft follows every change, half a second after the last (a slider dragged doesn't store the file again at every step).
    // An edit from the bag keeps no draft: the bag has the print, and an edit left unsaved is simply not saved.
    // Leaving sooner (a tap away right after a choice) saves at once: the last choice is never dropped.
    const saveNow = () => {
      pendingSave.current = null;
      void loadClient().then((c) => saveLive(c, source, settings));
    };
    pendingSave.current = editId ? null : saveNow;
    const save = editId ? undefined : setTimeout(saveNow, DRAFT_SAVE_MS);
    return () => clearTimeout(save);
    // `last` is only read for the status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, settings]);
  // Declared after the effect above, so on leaving its cleanup has run first and the save still pending is done here.
  useEffect(() => {
    const flush = () => pendingSave.current?.();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const patch = (p: Partial<Settings>) => {
    if (!settings) return;
    setAutoNote(null);
    setStartError(null);
    setSettings({ ...settings, ...p });
  };
  const applyFix = (f: { fix: Fix; settings: Settings; preview: PreviewOk }) => {
    setSettings(f.settings);
    track("upload_fix_applied", { reason: (preview as PreviewFail | null)?.code ?? "", fix: f.fix.id, passed: true });
    setStatus(`${f.fix.label.replace(/^Use /, "Now ")}. It prints.`);
  };

  /* ---------------- what the stage shows ---------------- */
  const ok = preview?.ok ? preview : null;
  const failed = preview && !preview.ok ? preview : null;
  const tee = choice === "both" ? (ok?.tee ?? last?.tee ?? "white") : choice;
  // The file, faded, while it converts: drawn once per file, turn, crop and tee (not on every render).
  const fade = useMemo(
    () => (source && settings && source.bitmap ? placeholder(source, settings, tee) : null),
    // The fade ignores the print's own settings (style, size, Stronger): only what changes the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, settings?.crop, settings?.rot, settings?.flip, settings?.light, settings?.contrast, tee],
  );
  // The tee the stage wears is the one its print is for (a print for the black tee drawn on the white one reads as a box of ink).
  const stageTee: Tee = busy ? (last ? (last.tees.includes(tee) ? tee : last.tee) : tee) : ok ? (ok.tees.includes(tee) ? tee : ok.tee) : (failed?.tee ?? tee);
  const stageState: StageState = useMemo(() => {
    if (!source) return { kind: "empty" };
    if (busy) return { kind: "converting", canvas: last?.canvas(last.tees.includes(tee) ? tee : last.tee) ?? fade };
    if (ok) return { kind: "ready", canvas: ok.canvas(ok.tees.includes(tee) ? tee : ok.tee) };
    if (failed) return { kind: "failed", canvas: failed.tee ? failed.canvas(failed.tee) : fade };
    return { kind: "converting", canvas: fade };
  }, [source, busy, last, tee, ok, failed, fade]);
  const pill = busy ? (last ? "Checking it prints…" : "Converting…") : undefined;
  const price = choice === "both" ? MAKE_PAIR_PRICE : MAKE_PRICE;
  const size$ = teeSize ?? selected;
  // The rights are the file's (a crop or a turn doesn't change whose it is).
  const rightsKey = source ? source.id : null;

  /* ---------------- the primary button of each step ---------------- */
  const toSize = () => ok && go("size");
  // Adding (or sending a replacement) is the rights confirmation: "you made it or have permission", said above the button.
  const confirmRights = () => {
    if (rightsFor === rightsKey) return;
    setRightsFor(rightsKey);
    track("upload_rights_confirm");
  };
  const add = async () => {
    if (!ok || !source || !settings) return;
    if (!size$) {
      // The sizes come into view, clear of the bar at the foot of a phone.
      scrollIntoViewQuietly(sizeRow.current);
      return setNudge((x) => x + 1);
    }
    confirmRights();
    const c = await loadClient();
    const tees = choice === "both" ? ok.tees : [choice as "black" | "white", ...ok.tees.filter((t) => t !== choice)];
    const id = await c.keep(source, ok, { title, tees, settings: { ...settings, size: ok.size } });
    const ref = { id, mode: ok.mode, size: ok.size, hash: ok.hash };
    if (editId) {
      // Saving an edit swaps the print in the lines it was in (each keeping its size and quantity), in the tees chosen now: "Both" adds the other colour, one tee makes the pair that tee (lib/cart editUpload).
      const want = choice === "both" ? ok.tees : [ok.tees.includes(choice) ? choice : ok.tee];
      // The draft (another picture in hand, if any) is left as it was: an edit never made or used one.
      useCartStore.setState((s) => ({ cart: editUpload(s.cart, YOURS_ID, editId, ref, want, size$) }));
      return router.push("/cart/");
    }
    const store = useCartStore.getState();
    const done = choice === "both" ? store.addPair(YOURS_ID, size$, { upload: ref, source: "product" }) : store.addToCart(YOURS_ID, size$, choice, 1, { upload: ref, source: "product" });
    if (!done) return;
    void import("@/store/tasteStore").then((m) => m.useTasteStore.getState().likeUpload(id, ok.measured));
    void clearLive(c);
    setDraftName(null);
    // The mini bag confirms; the button says so for a moment, then is itself again.
    flashAdded(true);
  };
  // "Upload another" for a refused file: once this one passes, it takes the refused one's place in the order.
  const resubmit = async () => {
    if (!ok || !source || !settings || !replaceId) return;
    const old = useMakeStore.getState().reviews[replaceId];
    if (!old) return;
    confirmRights();
    const c = await loadClient();
    const id = await c.keep(source, ok, { title, tees: [tee], settings: { ...settings, size: ok.size } });
    useMakeStore.getState().submitReviews(old.order, [id], { [id]: replaceId });
    void clearLive(c);
    track("upload_another");
    router.push("/me/");
  };

  const firstFix = fixes?.[0];
  const primary: { label: string; onClick?: () => void; href?: string; disabled?: boolean } | null =
    step === "start"
      ? { label: opening ? "Opening…" : "Choose a picture", onClick: pickFile, disabled: opening }
      : step === "print"
      ? ok && !busy
        ? { label: `Next · ${formatPrice(price)}`, onClick: toSize }
        : failed && !busy
          ? fixes === null
              ? { label: "Finding a fix…", disabled: true }
              : firstFix
                ? { label: firstFix.fix.label, onClick: () => applyFix(firstFix) }
                : { label: "Choose another file", onClick: () => fileInput.current?.click() }
          : { label: `Next · ${formatPrice(price)}`, disabled: true }
      : step === "size"
        ? replaceId
          ? { label: "Submit for review", onClick: () => void resubmit() }
          : added
            ? { label: "In your bag · Checkout", href: "/cart/", onClick: () => useUiStore.getState().requestCheckout() }
            : { label: ctaLabel({ verb: editId ? "Save changes" : "Add to bag", size: size$, price: MAKE_PRICE, both: choice === "both", pair: MAKE_PAIR_PRICE }), onClick: () => void add() }
        : null;

  const titles: Record<Step, string> = { start: "Your print", print: "Your print", size: "Size" };

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
          if (f) void choose(f);
          e.target.value = "";
        }}
      />
      <div
        className={`mx-auto max-w-5xl px-4 pb-28 md:pb-12 2xl:max-w-6xl ${step === "start" ? "pt-4" : "pt-1"}`}
        {...(step === "start"
          ? {
              onDragOver: (e: React.DragEvent) => (e.preventDefault(), setDrag(true)),
              // Leaving for a child (the tee, the button) isn't leaving the page.
              onDragLeave: (e: React.DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrag(false),
              onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void choose(f);
              },
            }
          : {})}
      >
        {step === "start" && (
          <div className="mb-4">
            <MakeHeader track="yours" />
          </div>
        )}
        {/* Only the size step has a way back, on the left as every page's (MakeView's "← Make"). */}
        {step === "size" && (
          <div className="mb-2 flex h-11 items-center">
            <button type="button" onClick={() => window.history.back()} className="inline-flex h-11 items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
              <Icon name="arrow-left" className="h-4 w-4" /> Your print
            </button>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          <div className="min-w-0 md:sticky md:top-4 md:self-start">
            <Stage shirt={shirt} tee={stageTee} state={stageState} source={source} pill={pill} label={title || "Your print"} onPick={pickFile} drag={drag} opening={opening} />
            <p aria-live="polite" className="sr-only" data-upload-status>
              {status}
            </p>
          </div>
          <div className="min-w-0 space-y-6">
            {/* The step's heading, as a product page's title: at the top of the column beside the picture (under it on a phone). */}
            <h2 ref={heading} tabIndex={-1} className="text-xl font-medium outline-none md:text-[28px]" data-step={step}>
              {titles[step]}
            </h2>
            {step === "start" && (
              <StartPanel error={startError} draftName={draftName} onCarryOn={carryOn} replacing={replacing} />
            )}
            {step === "print" && settings && (
              <PrintStep
                source={source}
                settings={settings}
                preview={preview}
                ok={ok}
                failed={failed}
                busy={busy}
                fixes={fixes}
                photo={!!source && (photos.current.has(source.id) || settings.mode !== "dots")}
                choice={choice}
                setChoice={setChoice}
                patch={patch}
                status={status}
                onFix={applyFix}
                onEdit={() => setEditing(true)}
                autoNote={autoNote}
                onAnother={() => fileInput.current?.click()}
                error={startError}
              />
            )}
            {step === "size" && ok && settings && (
              <SizeStep
                title={title}
                setTitle={setTitle}
                summary={`${ok.mode === "dots" ? "Dots" : ok.mode === "lines" ? "Lines" : ok.cls === "vector" ? "Line" : "Drawing"} · ${ok.size === "small" ? "Small" : "Full"} · ${choice === "both" ? "Both tees" : `${choice === "black" ? "Black" : "White"} tee`}`}
                onChange={() => go("print")}
                size={size$}
                setSize={(s) => (setTeeSize(s), useCartStore.getState().setSize(YOURS_ID, s))}
                nudge={nudge}
                sizeRef={sizeRow}
                replacing={!!replaceId}
              />
            )}
            {primary && <PrimaryBar {...primary} />}
          </div>
        </div>
      </div>
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

/** Before a file: what it takes, why a file was refused, the order a replacement is for, and the draft to carry on with. */
function StartPanel({ error, draftName, onCarryOn, replacing }: { error: string | null; draftName: string | null; onCarryOn: () => void; replacing?: { order: string } }) {
  return (
    <div className="-mt-3 space-y-3">
      <p id="yours-hint" className="text-sm text-neutral-400">
        Any picture, printed in one ink. JPG, PNG, WebP or SVG.
      </p>
      {error && (
        <p role="alert" className="text-sm text-neutral-200" data-upload-error>
          {error}
        </p>
      )}
      {replacing && <p className="rounded-control bg-white/[0.05] p-3 text-sm text-neutral-200 ring-1 ring-white/10">Replacing a file from order {replacing.order}. Once this one passes, it takes that one&rsquo;s place.</p>}
      {draftName && (
        <button type="button" onClick={onCarryOn} className="flex h-12 w-full items-center justify-between rounded-control px-4 text-left text-sm text-neutral-200 ring-1 ring-white/15 hover:bg-white/[0.05]" data-draft>
          <span className="truncate">Carry on with {draftName}</span>
          <Icon name="arrow-right" className="h-4 w-4 shrink-0" />
        </button>
      )}
    </div>
  );
}

function PrintStep({
  source,
  settings,
  preview,
  ok,
  failed,
  busy,
  fixes,
  photo,
  choice,
  setChoice,
  patch,
  status,
  onFix,
  onEdit,
  onAnother,
  autoNote,
  error,
}: {
  source: Source | null;
  settings: Settings;
  preview: Preview | null;
  ok: PreviewOk | null;
  failed: PreviewFail | null;
  busy: boolean;
  fixes: { fix: Fix; settings: Settings; preview: PreviewOk }[] | null;
  photo: boolean;
  choice: Choice;
  setChoice: (c: Choice) => void;
  patch: (p: Partial<Settings>) => void;
  status: string;
  onFix: (f: { fix: Fix; settings: Settings; preview: PreviewOk }) => void;
  onEdit: () => void;
  onAnother: () => void;
  autoNote: string | null;
  /** Another file picked here and refused: why (the picture in hand stays). */
  error: string | null;
}) {
  const [meaning, setMeaning] = useState<Record<string, string>>({});
  const [cropFix, setCropFix] = useState(false);
  useEffect(() => {
    if (!failed || !source) return setCropFix(false);
    let live = true;
    void loadClient()
      .then((c) => {
        if (!live) return;
        setMeaning(c.MEANING);
        setCropFix(c.fixesFor(failed, settings, source).some((f) => f.id === "crop"));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [failed, source, settings]);
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-neutral-200" data-upload-error>
          {error}
        </p>
      )}
      {ok?.autoSmall ? (
        <p className="text-sm text-neutral-300">Big enough for Small, not Full. We&rsquo;ve set Small.</p>
      ) : (
        autoNote && (
          <p className="text-sm text-neutral-300" data-auto-fix>
            {autoNote}
          </p>
        )
      )}
      {source && preview && <ChoiceThumbs source={source} settings={settings} preview={preview} photo={photo} choice={choice} onSettings={patch} onChoice={setChoice} />}
      {failed && !busy && (
        <div className="rounded-control bg-white/[0.04] p-4 ring-1 ring-white/10" data-fix-card>
          <p className="text-sm font-medium text-white" data-upload-line>
            {failed.reason}
          </p>
          {meaning[failed.code] && <p className="mt-1 text-sm text-neutral-400">{meaning[failed.code]}</p>}
          {fixes === null && <p className="mt-3 text-xs text-neutral-400">Finding a fix…</p>}
          {fixes?.length === 0 && !cropFix && (
            <p className="mt-1 text-sm text-neutral-400" data-no-fix>
              {source?.kind === "file" && failed.code !== "blank" ? "Try a different crop in Edit photo, or another picture." : "Try another picture."}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(fixes ?? []).slice(1).map((f) => (
              <button key={f.fix.id} type="button" onClick={() => onFix(f)} className="h-11 rounded-control px-4 text-sm font-medium text-white ring-1 ring-white/30 hover:bg-white/10" data-fix={f.fix.id}>
                {f.fix.label}
              </button>
            ))}
            {cropFix && (
              <button type="button" onClick={onEdit} className="h-11 rounded-control px-4 text-sm font-medium text-white ring-1 ring-white/30 hover:bg-white/10" data-fix="crop">
                Crop tighter
              </button>
            )}
          </div>
        </div>
      )}
      {preview === null && <p className="text-sm text-neutral-400">{status || "Converting…"}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {source && source.kind === "file" && (
          <button type="button" onClick={onEdit} className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-sm font-medium text-white ring-1 ring-white/25 hover:bg-white/10" data-edit-photo>
            <Icon name="pencil" className="h-4 w-4" /> Edit photo
          </button>
        )}
        <button type="button" onClick={onAnother} className="h-11 text-sm text-neutral-300 underline underline-offset-4 hover:text-white">
          Choose another file
        </button>
      </div>
    </>
  );
}

function WontPrint({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="wont-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-sheet bg-ink-900 p-5 ring-1 ring-white/10 md:rounded-sheet">
        <h2 id="wont-title" className="text-base font-medium">
          What we won&rsquo;t print
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
          {WONT_PRINT.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <button type="button" data-autofocus onClick={onClose} className="mt-5 flex h-12 w-full items-center justify-center rounded-control text-sm font-medium text-white ring-1 ring-white/30">
          Close
        </button>
      </div>
    </div>
  );
}

function SizeStep({
  title,
  setTitle,
  summary,
  onChange,
  size,
  setSize,
  nudge,
  sizeRef,
  replacing,
}: {
  title: string;
  setTitle: (t: string) => void;
  summary: string;
  onChange: () => void;
  size?: ShirtSize;
  setSize: (s: ShirtSize) => void;
  nudge: number;
  sizeRef: React.RefObject<HTMLDivElement>;
  replacing: boolean;
}) {
  // The title is the one made from the file; a tap on it (or the pencil) edits it.
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [wont, setWont] = useState(false);
  const save = async (v: string) => {
    const t = v.trim();
    const lex = await import("@/lib/custom/lexicon");
    const problem = t.length < 3 || t.length > 40 ? "A title of 3 to 40 characters." : lex.wordsProblem(t);
    setError(problem);
    if (!problem) (setTitle(t), setEditingTitle(false));
  };
  return (
    <div className="space-y-4">
      <div>
        {editingTitle ? (
          <>
            <label htmlFor="upload-title" className="sr-only">
              Title
            </label>
            <input
              id="upload-title"
              value={draft}
              maxLength={40}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => void save(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void save(draft))}
              aria-invalid={!!error}
              className="h-11 w-full rounded-control bg-white/[0.06] px-3 text-base font-medium text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-white"
              data-title
            />
            {error && <p className="mt-1 text-xs text-neutral-300">{error}</p>}
          </>
        ) : (
          <button type="button" onClick={() => (setDraft(title), setEditingTitle(true))} className="flex min-h-11 max-w-full items-center gap-2 text-left text-base font-medium text-white" aria-label={`Title: ${title}. Edit`} data-title-text>
            <span className="truncate">{title}</span>
            <Icon name="pencil" className="h-4 w-4 shrink-0 text-neutral-400" />
          </button>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-neutral-300" data-summary>
        {summary}
        <button type="button" onClick={onChange} className="h-11 text-neutral-400 underline underline-offset-4 hover:text-white">
          Change
        </button>
      </p>
      {!replacing && (
        <div ref={sizeRef} className="scroll-mb-32">
          <SizeSelector key={nudge} value={size} onChange={setSize} highlight={nudge > 0 && !size} />
        </div>
      )}
      <p className="text-sm text-neutral-400">Checked by a person before printing. Up to 2 days. Nothing charged if we can&rsquo;t print it.</p>
      <TrustLine custom review />
      {/* The rights, confirmed by adding: one line above the button. */}
      <p className="text-xs text-neutral-400" data-rights>
        {replacing ? "Submitting it" : "Adding it"} confirms you made it or have permission, and anyone in it has agreed.{" "}
        <button type="button" onClick={() => setWont(true)} className="text-neutral-300 underline underline-offset-4 hover:text-white">
          What we won&rsquo;t print
        </button>
      </p>
      {wont && <WontPrint onClose={() => setWont(false)} />}
    </div>
  );
}

/** The step's one white button: in the flow on desktop, a bar at the foot of the screen on a phone. */
function PrimaryBar({ label, onClick, href, disabled }: { label: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const cls = `w-full ${BUTTON_PRIMARY}`;
  const bar = useRef<HTMLDivElement>(null);
  useDock(bar, true, true);
  const button = href ? (
    <Link href={href} onClick={onClick} className={cls} data-primary>
      {label}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} data-primary>
      {label}
    </button>
  );
  return (
    <div ref={bar} className="fixed inset-x-0 bottom-0 z-header border-t border-white/10 bg-[#0a0a0a] px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:static md:border-0 md:bg-transparent md:p-0">
      {button}
    </div>
  );
}
