"use client";

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import { BUTTON_PRIMARY, SizeSelector, STAGE_BG, TeeChoice, TrustLine, useSizeRequired } from "@/components/ui";
import { useDock } from "@/hooks/useDock";
import { ZoomViewer } from "@/components/ZoomViewer";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { CustomPrint } from "@/components/custom/CustomPrint";
import type { EditorProps, EditorState } from "@/components/custom/editors/types";
import { CaptionField, capFromDrafts, type CapDraft } from "@/components/custom/editors/CaptionField";
import { useLexicon } from "@/components/custom/editors/Field";
import { SHIRTS, getShirtById } from "@/lib/catalog";
import { track } from "@/lib/analytics";
import { ctaLabel, lineKey, pairPrice, pairStatus, unitPrice } from "@/lib/cart";
import { loadCanvasFonts } from "@/lib/custom/canvasSvg";
import { checkPrint, type PrintCheck } from "@/lib/custom/printCheck";
import { MADE, MAKE_GROUPS, madeBySlug, type MadeProduct } from "@/lib/custom/products";
import { FROM_KEY } from "@/lib/custom/makeFrom";
import { inkFromCanvas } from "@/lib/custom/raster";
import { loadCaptioner, loadRenderer, type Captioner, type Renderer } from "@/lib/custom/renderers";
import type { Lines } from "@/lib/custom/kit";
import type { Cap } from "@/lib/custom/specKit";
import { drawOnly } from "@/lib/custom/svg";
import { capRuleFor, wordsTitle, decodeMake, encodeMake, validate, type CustomSpec, type TemplateId } from "@/lib/custom/spec";
import { SIZES } from "@/lib/images";
import { sizeFor, useCartStore } from "@/store/cartStore";
import { useTasteStore } from "@/store/tasteStore";
import { scrollIntoViewQuietly, useHydrated, useUiStore } from "@/store/useUiStore";
import { updateQuery } from "@/lib/url";
import { otherColor, teeColor, type BaseColor } from "@/types/shirt";

// Prints on this page are drawn, never saved: no minifying (lib/custom/svg).
drawOnly();

/** The preview waits this long after a change (longer on a device where a render is slow). */
const DEBOUNCE = 150;
const SLOW_DEBOUNCE = 300;
/** A draw and check slower than this marks the device slow (its preview then waits longer after a keystroke). */
const SLOW_MS = 100;
/** The other tee is checked this long after the first is shown. */
const OTHER_TEE_MS = 250;
/** How long a tap made before the print is ready is kept (longer, and the add would come as a surprise). */
const WAIT_MS = 4000;

/** Each product's fields, a chunk of its own (a product's page loads only its editor). */
const DateEditor = lazy(() => import("@/components/custom/editors/DateEditor"));
const EDITORS: Partial<Record<TemplateId, ComponentType<EditorProps>>> = {
  sky: DateEditor,
  moon: DateEditor,
  night: DateEditor,
  planets: DateEditor,
  taste: lazy(() => import("@/components/custom/editors/TasteEditor")),
  code: lazy(() => import("@/components/custom/editors/CodeEditor")),
  line: lazy(() => import("@/components/custom/editors/LineEditor")),
  voice: lazy(() => import("@/components/custom/editors/VoiceEditor")),
  house: lazy(() => import("@/components/custom/editors/HouseEditor")),
  number: lazy(() => import("@/components/custom/editors/NumberEditor")),
  place: lazy(() => import("@/components/custom/editors/PlaceEditor")),
  ascii: lazy(() => import("@/components/custom/editors/AsciiEditor")),
  weeks: lazy(() => import("@/components/custom/editors/WeeksEditor")),
  elements: lazy(() => import("@/components/custom/editors/ElementsEditor")),
  crossword: lazy(() => import("@/components/custom/editors/CrosswordEditor")),
  journey: lazy(() => import("@/components/custom/editors/JourneyEditor")),
  snowflake: lazy(() => import("@/components/custom/editors/SnowflakeEditor")),
  maze: lazy(() => import("@/components/custom/editors/MazeEditor")),
  automaton: lazy(() => import("@/components/custom/editors/AutomatonEditor")),
  julia: lazy(() => import("@/components/custom/editors/JuliaEditor")),
  rings: lazy(() => import("@/components/custom/editors/RingsEditor")),
  family: lazy(() => import("@/components/custom/editors/FamilyEditor")),
  orbits: lazy(() => import("@/components/custom/editors/OrbitsEditor")),
  tartan: lazy(() => import("@/components/custom/editors/TartanEditor")),
  musicbox: lazy(() => import("@/components/custom/editors/MusicboxEditor")),
  monogram: lazy(() => import("@/components/custom/editors/MonogramEditor")),
  chess: lazy(() => import("@/components/custom/editors/ChessEditor")),
  metro: lazy(() => import("@/components/custom/editors/MetroEditor")),
  route: lazy(() => import("@/components/custom/editors/RouteEditor")),
  island: lazy(() => import("@/components/custom/editors/IslandEditor")),
  qr: lazy(() => import("@/components/custom/editors/QrEditor")),
  landmarks: lazy(() => import("@/components/custom/editors/LandmarksEditor")),
  dinosaur: lazy(() => import("@/components/custom/editors/DinosaurEditor")),
  frontpage: lazy(() => import("@/components/custom/editors/FrontpageEditor")),
  passport: lazy(() => import("@/components/custom/editors/PassportEditor")),
  flights: lazy(() => import("@/components/custom/editors/FlightsEditor")),
  countries: lazy(() => import("@/components/custom/editors/CountriesEditor")),
  sampler: lazy(() => import("@/components/custom/editors/SamplerEditor")),
  patch: lazy(() => import("@/components/custom/editors/PatchEditor")),
  lineup: lazy(() => import("@/components/custom/editors/LineupEditor")),
  tour: lazy(() => import("@/components/custom/editors/TourEditor")),
  signpost: lazy(() => import("@/components/custom/editors/SignpostEditor")),
  sign: lazy(() => import("@/components/custom/editors/SignEditor")),
  birth: lazy(() => import("@/components/custom/editors/BirthEditor")),
  message: lazy(() => import("@/components/custom/editors/MessageEditor")),
  receipt: lazy(() => import("@/components/custom/editors/ReceiptEditor")),
  card: lazy(() => import("@/components/custom/editors/CardEditor")),
  credits: lazy(() => import("@/components/custom/editors/CreditsEditor")),
  label: lazy(() => import("@/components/custom/editors/LabelEditor")),
  sayings: lazy(() => import("@/components/custom/editors/SayingsEditor")),
  editions: lazy(() => import("@/components/custom/editors/EditionsEditor")),
  telegram: lazy(() => import("@/components/custom/editors/TelegramEditor")),
};

/** The data a print is drawn from, credited where it's used (the place list's licence asks for it). */
const CREDITS: Partial<Record<TemplateId, string>> = {
  sky: "Places: GeoNames (CC BY 4.0).",
  place: "Places: GeoNames (CC BY 4.0).",
  journey: "Places: GeoNames (CC BY 4.0).",
};

interface Shown {
  spec: CustomSpec;
  svg: string;
  color: BaseColor;
  /** The print check; null for the moment between the picture painting and its check (a separate task, so a keystroke's work is split). */
  check: PrintCheck | null;
  /** Whether the other tee prints this spec too (the pair is offered only then); null until checked. */
  other: boolean | null;
  /** The print on the other tee, once checked (shown beside this one when both are chosen). */
  otherSvg?: string;
}

/**
 * A Make product's page: the editor is the page. Its own fields (a name, a
 * line, a night), the picture redrawn as you go, then size and bag. The
 * address carries the print (`?make=`), so a reload or a shared link opens
 * it as it was. Every print passes the catalogue's gate before it can be
 * bought; a pair only when both tees pass.
 */
/** "More from a date →": this product's group on the index. */
function MoreFrom({ made }: { made: MadeProduct }) {
  const group = MAKE_GROUPS.find((g) => g.id === made.group);
  if (!group || !MADE.some((m) => m.group === made.group && m.slug !== made.slug)) return null;
  return (
    <Link href={`/make/#${made.group}`} className="text-xs text-neutral-300 underline underline-offset-2 hover:text-white" data-siblings>
      More {group.label.toLowerCase()} →
    </Link>
  );
}

export function MakeView({ slug }: { slug: string }) {
  const made = madeBySlug(slug);
  // Pages are only built for known slugs; anything else gets the way back, never a crash.
  if (!made)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-neutral-300">This print isn&rsquo;t here.</p>
        <Link href="/make/" className="mt-4 inline-block text-sm underline underline-offset-2">
          See what you can make →
        </Link>
      </main>
    );
  return <Maker made={made} />;
}

function Maker({ made }: { made: MadeProduct }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const shirt = getShirtById(made.id);
  const pickedColor = useCartStore((s) => s.selectedColors[made.id]);
  const setColor = useCartStore((s) => s.setColor);
  const size = useCartStore((s) => (hydrated ? sizeFor(s, made.id) : undefined));
  const setSize = useCartStore((s) => s.setSize);
  const cart = useCartStore((s) => s.cart);
  const [both, setBoth] = useState(false);
  const color: BaseColor = shirt ? teeColor(shirt, hydrated ? pickedColor : null) : "black";

  // The print the address arrived with, if it's this product's (read once, after hydration).
  const [arrival, setArrival] = useState<CustomSpec | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated || arrival !== undefined) return;
    const q = new URLSearchParams(window.location.search);
    const spec = decodeMake(q.get("make"));
    setArrival(spec && spec.t === made.template ? spec : null);
    // "Edit" from the bag names the line it edits: saving replaces that line.
    setEditKey(q.get("edit"));
    // Where this visit came from (the index card or For two set it on the way here), for Back and analytics.
    let from = "";
    try {
      from = sessionStorage.getItem(FROM_KEY) ?? "";
      sessionStorage.removeItem(FROM_KEY);
    } catch {
      /* storage unavailable */
    }
    const source = from === "index" || from === "two" ? from : "design";
    setCameFrom(source);
    track("make_open", { product: made.slug, group: made.group, source });
  }, [hydrated, arrival, made]);

  const [cameFrom, setCameFrom] = useState<"index" | "two" | "design">("design");
  const [editKey, setEditKey] = useState<string | null>(null);
  const editing = editKey ? cart.find((l) => lineKey(l) === editKey) : undefined;
  // "Edit" from the bag opens the line as it is: its colour and size (not the ones last picked for this design).
  const editedLine = useRef<string | null>(null);
  useEffect(() => {
    if (!editing || editedLine.current === editKey) return;
    editedLine.current = editKey;
    useCartStore.getState().setColor(editing.id, editing.color);
    useCartStore.getState().setSize(editing.id, editing.size);
  }, [editing, editKey]);
  // What the editor makes of its fields.
  const [edited, setEdited] = useState<EditorState>({ spec: null });
  // The caption waits for the editor's first report: typed into while the editor's code was still loading, a slow phone lost it as the editor came in.
  const [editorIn, setEditorIn] = useState(false);
  const onEditor = useCallback((s: EditorState) => {
    setEdited(s);
    setEditorIn(true);
  }, []);
  // The visitor's own caption lines (CaptionField), from the address's print when it has some: a link from before
  // captions carries its words as `w`, the title of the products whose editors now write cap[0].
  const capRule = capRuleFor(made.template);
  const [capDraft, setCapDraft] = useState<CapDraft>([]);
  useEffect(() => {
    if (!arrival) return;
    const p = arrival.p as { cap?: Cap; w?: string };
    const draft: CapDraft = [...(p.cap ?? [])];
    if (wordsTitle(made.template) && p.w && (draft[0] ?? null) === null) draft[0] = p.w;
    setCapDraft(draft);
  }, [arrival, made.template]);
  const capLex = useLexicon(capDraft.some((d) => !!d));
  const cap = capFromDrafts(capDraft, capRule, capLex);
  // The print: the editor's fields and the caption's lines together (a caption line that can't print holds it back, with its reason).
  const mergedKey = edited.spec && cap ? JSON.stringify(validate({ ...edited.spec, p: { ...edited.spec.p, cap } })) : "";
  const merged = useMemo(() => (mergedKey && mergedKey !== "null" ? (JSON.parse(mergedKey) as CustomSpec) : null), [mergedKey]);
  // The whole team's prints take the visitor's caption too.
  const batchKey = edited.batch && cap ? JSON.stringify(edited.batch.map((b) => validate({ ...b, p: { ...b.p, cap } }))) : "";
  const batch = useMemo(() => (batchKey ? (JSON.parse(batchKey) as (CustomSpec | null)[]).filter((b): b is CustomSpec => !!b) : undefined), [batchKey]);
  const state: EditorState = useMemo(() => ({ ...edited, spec: merged, batch }), [edited, merged, batch]);
  // Until the fields make a print (empty, or not yet valid), the stage shows the product's example.
  // A field gone invalid keeps the last print that was (never a jump back to the example, as if the input were ignored).
  const lastGood = useRef<CustomSpec | null>(null);
  if (state.spec && !state.blocked) lastGood.current = state.spec;
  const example = state.blocked || (!state.spec && !lastGood.current);
  const spec = example ? made.example : (state.spec ?? lastGood.current);

  // The picture: debounced, checked (a print that won't print well isn't offered), and the address kept in step.
  const [shown, setShown] = useState<Shown | null>(null);
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  useEffect(() => {
    let live = true;
    loadCanvasFonts();
    loadRenderer(made.template).then((r) => live && setRenderer(() => r));
    return () => {
      live = false;
    };
  }, [made.template]);
  const slow = useRef(false);
  /** Draws the print now (fonts loaded) and checks it: at once, or (`later`) in the next task, so the picture paints first. */
  const draw = useCallback(
    (spec: CustomSpec, color: BaseColor, later = false): Shown | null => {
      if (!renderer) return null;
      const start = performance.now();
      let svg: string;
      try {
        svg = renderer(spec, color, state.data ?? {});
      } catch {
        // Its data isn't in yet (the example sky before the editor has its place): drawn when it is.
        return null;
      }
      const real = spec === state.spec && !state.blocked;
      const checked = (check: PrintCheck) => {
        if (performance.now() - start > SLOW_MS) slow.current = true;
        // The address carries a print once it's known to print.
        if (check.ok && real) {
          updateQuery((q) => q.set("make", encodeMake(spec)));
        }
        return check;
      };
      if (!later) {
        const next = { spec, svg, color, check: checked(checkPrint(inkFromCanvas(svg, color), made.hints)), other: null };
        setShown(next);
        return next;
      }
      const first: Shown = { spec, svg, color, check: null, other: null };
      setShown(first);
      setTimeout(() => {
        const check = checked(checkPrint(inkFromCanvas(svg, color), made.hints));
        setShown((s) => (s === first ? { ...s, check } : s));
      }, 0);
      return first;
    },
    [renderer, state.data, state.blocked, state.spec, made.hints],
  );
  useEffect(() => {
    if (!spec || !renderer) return;
    const t = setTimeout(() => loadCanvasFonts().then(() => draw(spec, color, true)), slow.current ? SLOW_DEBOUNCE : DEBOUNCE);
    return () => clearTimeout(t);
  }, [spec, renderer, color, draw]);
  // Then, quietly, the other tee: the pair is offered only when both print.
  useEffect(() => {
    if (!shown || shown.other !== null || !shown.check?.ok || !renderer || !shirt || shirt.colors.length < 2) return;
    const t = setTimeout(() => {
      const c = otherColor(shown.color);
      let otherSvg: string;
      try {
        otherSvg = renderer(shown.spec, c, state.data ?? {});
      } catch {
        return;
      }
      const ok = checkPrint(inkFromCanvas(otherSvg, c), made.hints).ok;
      setShown((s) => (s === shown ? { ...s, other: ok, otherSvg } : s));
    }, OTHER_TEE_MS);
    return () => clearTimeout(t);
  }, [shown, renderer, shirt, state.data, made.hints]);
  const current = shown && shown.spec === spec && shown.color === color ? shown : null;
  const ready = !!current?.check?.ok && !example && !!state.spec && current.spec === state.spec;
  const pairOk = current?.other === true;
  useEffect(() => {
    if (both && current && current.other === false) setBoth(false);
  }, [both, current]);

  // The bag.
  const addToCart = useCartStore((s) => s.addToCart);
  const addPair = useCartStore((s) => s.addPair);
  // What was just added (this print, size and colour): the button then leads to the bag, until any of them changes.
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const choiceKey = `${state.spec ? JSON.stringify(state.spec) : ""}|${size}|${both ? "both" : color}|${state.batch?.length ?? 0}`;
  const inBag = !editing && addedKey === choiceKey;
  // Without a size, the sizes come into view with the focus (the bar at the foot of a phone is far from them).
  const { nudge, groupRef: sizeRow, require: needSize, status: sizeStatus } = useSizeRequired("make");
  const [tried, setTried] = useState(false);
  const unit = shirt ? unitPrice({ custom: true }, shirt) : 0;
  const pairTotal = pairPrice(spec ?? undefined);
  const pair = both && size && spec ? pairStatus(cart, made.id, size, spec) : null;
  // A tap before the print is ready (a slow phone: the drawing code or the word list still loading) is kept, and done once it is, if that's soon.
  const [waiting, setWaiting] = useState(0);
  const onBuy = () => {
    if (inBag) {
      track("sticky_checkout_click", { from: "make" });
      useUiStore.getState().requestCheckout();
      return router.push("/cart/");
    }
    if (!state.spec) {
      setTried(true);
      setWaiting(Date.now());
      // Once the errors show: a field that can't print comes into view with the focus (its reason under it), and the tap isn't kept. Else it's still loading, and the tap waits.
      requestAnimationFrame(() => {
        const bad = document.querySelector<HTMLElement>("form [aria-invalid='true']");
        if (!bad) return;
        setWaiting(0);
        scrollIntoViewQuietly(bad);
        bad.focus({ preventScroll: true });
      });
      return;
    }
    if (!renderer) return setWaiting(Date.now());
    // A tap right after a change doesn't wait for the preview: the print is drawn and checked now.
    const now = ready ? current : draw(state.spec, color);
    if (!now?.check?.ok) return;
    if (!size) return needSize();
    // Both chosen before the other tee's quiet check came in (a heavy print): checked now, never a single tee added
    // under a button that said the pair. If the other tee can't print, nothing is added and the choice goes back to one tee.
    let pairNow = pairOk;
    if (both && !pairOk && current?.other !== false) {
      try {
        const c = otherColor(color);
        pairNow = checkPrint(inkFromCanvas(renderer(state.spec, c, state.data ?? {}), c), made.hints).ok;
      } catch {
        pairNow = false;
      }
      if (!pairNow) return setBoth(false);
    }
    if (editing) {
      // Saving an edit replaces its line (its quantity kept), then back to the bag.
      useCartStore.getState().changeCartItem(editing, { custom: state.spec, color, size });
      // Both tees chosen: the other colour joins it, as the pair.
      if (both && pairNow) addPair(made.id, size, { source: "product", custom: state.spec, silent: true });
      track("customize_apply", { template: made.template, caption_edited: capEdited });
      return router.push("/cart/");
    }
    // The whole team: every print checked, then each added as its own line (its size can change in the bag).
    const batch = state.batch?.length ? state.batch : null;
    if (batch && !batch.every((b) => draw(b, color)?.check?.ok)) return;
    const ok = batch
      ? batch.map((b) => addToCart(made.id, size, color, 1, { source: "product", custom: b })).every(Boolean)
      : both && pairNow
        ? addPair(made.id, size, { source: "product", custom: state.spec })
        : addToCart(made.id, size, color, 1, { source: "product", custom: state.spec });
    if (!ok) return;
    setAddedKey(choiceKey);
    // A small like of the design it's drawn like (its taste, never the inputs; once per design).
    const base = SHIRTS.find((s) => s.variant === made.base);
    if (base) useTasteStore.getState().likeCustom(base.id);
    track("customize_apply", { template: made.template, caption_edited: capEdited });
  };
  const onBuyRef = useRef(onBuy);
  onBuyRef.current = onBuy;
  useEffect(() => {
    if (!waiting || !renderer || !state.spec) return;
    setWaiting(0);
    if (Date.now() - waiting < WAIT_MS) void loadCanvasFonts().then(() => onBuyRef.current());
  }, [waiting, renderer, state.spec]);
  // One pattern everywhere: "[verb] · [size] · [price]", the price always in it (made for you: MAKE_PRICE, the pair MAKE_PAIR_PRICE).
  const buyLabel = inBag
    ? "In your bag · Checkout"
    : editing
      ? ctaLabel({ verb: "Save changes", size, price: unit, both, pair: pairTotal })
      : state.batch?.length
        ? ctaLabel({ verb: `Add ${state.batch.length} to bag`, size, price: unit * state.batch.length })
        : ctaLabel({ size, price: unit, both, pair: pairTotal, status: pair });

  // How many caption lines are the visitor's (analytics counts them, never the words).
  const capEdited = (state.spec ? ((state.spec.p as { cap?: Cap }).cap ?? []) : []).filter((c) => c !== null).length;
  // The caption as we'd print it (each line not yet rewritten follows the fields), for the caption editor.
  const [captioner, setCaptioner] = useState<Captioner | null>(null);
  useEffect(() => {
    let live = true;
    loadCaptioner(made.template).then((c) => live && setCaptioner(() => c));
    return () => {
      live = false;
    };
  }, [made.template]);
  const ours: Lines = (() => {
    if (!captioner || !spec) return [undefined];
    try {
      return captioner(spec, state.data ?? {});
    } catch {
      return [undefined];
    }
  })();
  // The page's title says the visitor's title line when there is one.
  const titleLine = (spec?.p as { cap?: Cap } | undefined)?.cap?.[0];
  useEffect(() => {
    if (!titleLine) return;
    const before = document.title;
    document.title = `${titleLine} · ${made.name} | MONO`;
    // Back to the page's own when the line is reset or cleared.
    return () => void (document.title = before);
  }, [titleLine, made.name]);

  const [zoom, setZoom] = useState(false);
  // A phone's square stage frames the print on the chest; wider screens show the whole view.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  const [view, setView] = useState<"tee" | "print">("tee");

  if (!shirt) return null;
  const Editor = EDITORS[made.template];
  const svg = shown && shown.color === color ? shown.svg : null;
  const problem = current?.check && !current.check.ok && !state.blocked ? current.check.reason : null;

  return (
    <div className="no-scrollbar relative -mt-[var(--header-h)] min-h-0 flex-1 overflow-y-auto pt-[var(--header-h)]">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-1 2xl:max-w-6xl">
        <div className="mb-2 flex items-center justify-between">
          <Link
            href={`/make/#${made.group}`}
            onClick={(e) => {
              // From the index or For two: back where it came from (and its scroll).
              if ((cameFrom === "index" || cameFrom === "two") && window.history.length > 1) {
                e.preventDefault();
                router.back();
              }
            }}
            className="inline-flex h-11 items-center gap-1.5 text-sm text-neutral-400 hover:text-white"
          >
            <Icon name="arrow-left" className="h-4 w-4" /> Make
          </Link>
          {ready && current && (
            <button
              type="button"
              onClick={() => useUiStore.getState().openShare(made.id, color, encodeMake(current.spec))}
              aria-label="Share"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 hover:text-white"
            >
              <Icon name="share-2" className="h-5 w-5" />
            </button>
          )}
        </div>
        {/* min-w-0 on both columns: a long unbroken word in a field or a message wraps, never widens the page. */}
        <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
          <div className={`relative flex aspect-square max-h-[56dvh] w-full items-center justify-center overflow-hidden rounded-[28px] ring-1 ring-white/10 md:sticky md:top-4 md:aspect-[4/5] md:max-h-none ${STAGE_BG}`}>
            <button type="button" onClick={() => setZoom(true)} aria-label="Zoom in on the print" className="flex h-full w-full cursor-zoom-in items-center justify-center p-5 pb-14">
              {view === "print" && svg ? (
                <div className="aspect-[3/4] h-[88%] overflow-hidden rounded-[3px] shadow-2xl shadow-black/60">
                  <CustomPrint svg={svg} />
                </div>
              ) : svg && both && current?.otherSvg ? (
                // Both tees, side by side (the one chosen first).
                <div className="flex h-full w-full items-center justify-center gap-2" data-both>
                  <CustomMockup shirt={shirt} svg={svg} color={color} sizes={SIZES.product} className="max-h-full min-w-0 flex-1" />
                  <CustomMockup shirt={shirt} svg={current.otherSvg} color={otherColor(color)} sizes={SIZES.product} className="max-h-full min-w-0 flex-1" />
                </div>
              ) : svg ? (
                <CustomMockup shirt={shirt} svg={svg} color={color} sizes={SIZES.product} crop={narrow} className="h-full max-h-full" />
              ) : (
                <div className="aspect-[512/704] h-full rounded-control bg-white/[0.03]" aria-hidden />
              )}
            </button>
            {!state.blocked && (
              <div className="absolute bottom-3 left-3">
                <TeeChoice
                  value={both ? "both" : color}
                  original={shirt.baseColor}
                  colors={shirt.colors}
                  noBoth={!pairOk}
                  pairPrice={pairTotal}
                  onChange={(c) => {
                    setBoth(c === "both");
                    if (c !== "both") setColor(made.id, c);
                  }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setView((v) => (v === "tee" ? "print" : "tee"))}
              className="absolute bottom-3 right-3 flex h-11 items-center rounded-control bg-black/55 px-3 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-md"
            >
              {view === "tee" ? "Print" : "On the tee"}
            </button>
            <AnimatePresence>{zoom && svg && <ZoomViewer shirt={shirt} color={color} initialView={view} customSvg={svg} onClose={() => setZoom(false)} />}</AnimatePresence>
          </div>

          <div>
            <h1 className="text-xl font-medium md:text-[28px]">{made.name}</h1>
            <p className="mt-1 text-sm text-neutral-400">{made.line}</p>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(e) => {
                // Enter (a phone's Go) closes the keyboard; it never buys.
                e.preventDefault();
                (document.activeElement as HTMLElement | null)?.blur();
              }}
              noValidate
            >
              {Editor && arrival !== undefined && (
                <Suspense fallback={<div className="h-24 rounded-control bg-white/[0.03]" aria-hidden />}>
                  <Editor made={made} arrival={arrival} touched={tried} onChange={onEditor} />
                </Suspense>
              )}
              {Editor && arrival !== undefined && editorIn && !state.blocked && <CaptionField ours={ours} value={capDraft} onChange={setCapDraft} rule={capRule} follows={made.from.toLowerCase()} />}
              {problem && (
                <p className="text-xs text-neutral-300" role="status" data-print-problem>
                  {problem}
                </p>
              )}
              {!state.blocked && (
                <>
                  <div className="mt-1 scroll-mb-28">
                    <SizeSelector key={nudge} value={size} onChange={(s) => setSize(made.id, s)} highlight={nudge > 0 && !size} groupRef={sizeRow} />
                    {sizeStatus}
                  </div>
                  <button type="button" onClick={onBuy} disabled={!hydrated} className={`hidden md:flex ${BUTTON_PRIMARY}`} aria-live="polite">
                    <span className="tabular-nums">{buyLabel}</span>
                  </button>
                  {/* The promises, from the policy (made-for-you tees: the size-exchange exception). */}
                  <TrustLine custom />
                  {CREDITS[made.template] && <p className="text-xs text-muted">{CREDITS[made.template]}</p>}
                  <div>
                    <MoreFrom made={made} />
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
      {!state.blocked && (
        <MakeBar>
          <button type="button" onClick={onBuy} disabled={!hydrated} className={`min-w-0 flex-1 whitespace-nowrap ${BUTTON_PRIMARY}`}>
            <span className="truncate tabular-nums">{buyLabel}</span>
          </button>
        </MakeBar>
      )}
    </div>
  );
}

/** Phones: the editor's own bottom bar (the tab bar gives way to it), counted in the dock so a toast sits above it. */
function MakeBar({ children }: { children: React.ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  useDock(bar, true, true);
  return (
    <div ref={bar} className="sticky bottom-0 z-header flex items-center gap-3 border-t border-white/10 bg-[#0a0a0a] px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:hidden">
      {children}
    </div>
  );
}
