"use client";

import { Suspense, lazy, useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Header } from "@/components/Header";
import { TabBar } from "@/components/TabBar";
import { MiniBag } from "@/components/shop/MiniBag";
import { Toast } from "@/components/Toast";
import { useCartStore } from "@/store/cartStore";
import { migrateLegacySession, removeRetiredKeys } from "@/store/legacySession";
import { useTasteStore } from "@/store/tasteStore";
import { useUiStore } from "@/store/useUiStore";
import { syncFromStorage } from "@/store/sync";
import { decodeTaste } from "@/lib/taste";
import { assetUrl, catalogReady, isCatalogFailed, isCatalogReady } from "@/lib/catalog";
import { updateQuery } from "@/lib/url";
import { whenIdle } from "@/lib/preload";
import { captureLanding, track } from "@/lib/analytics";
import { BUTTON_PRIMARY } from "@/components/ui";

/** Suspends (keeping the server HTML) until the catalog index has loaded; says so, with a reload, if it can't. */
function CatalogGate({ children }: { children: React.ReactNode }) {
  if (isCatalogFailed()) return <LoadFailed />;
  if (!isCatalogReady()) throw catalogReady();
  return <>{children}</>;
}

function LoadFailed() {
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" data-load-failed>
      <p className="text-base text-neutral-200">Something went wrong.</p>
      <button type="button" onClick={() => window.location.reload()} className={BUTTON_PRIMARY}>
        Try again
      </button>
    </div>
  );
}

/** The Open Call sheet loads only when it's opened (from an upload's review status). */
// Loaded when first needed: the debug panel (?debug=1) and the share sheet (with its image renderer).
const AlgoDebugPanel = lazy(() => import("@/components/AlgoDebugPanel").then((m) => ({ default: m.AlgoDebugPanel })));
const ShareSheet = lazy(() => import("@/components/ShareSheet").then((m) => ({ default: m.ShareSheet })));
const OfferSheet = lazy(() => import("@/components/upload/OfferSheet").then((m) => ({ default: m.OfferSheet })));

export function AppShell({ children }: { children: React.ReactNode }) {
  const offerOpen = useUiStore((s) => !!s.offer);
  const pathname = usePathname();
  const hydrated = useUiStore((s) => s.hydrated);
  const debug = useUiStore((s) => s.debug);
  // Kept mounted once opened, so the sheet's close animation still plays.
  const sharing = useUiStore((s) => s.share != null);
  const [shareLoaded, setShareLoaded] = useState(false);
  if (sharing && !shareLoaded) setShareLoaded(true);

  // How this visit arrived (UTM, ref, a shared taste or list), recorded
  // before any page removes those tags from the address bar: layout
  // effects run before every page's passive effects.
  useLayoutEffect(() => void captureLanding(), []);

  // Framed by another site (clickjacking: the static host can't send frame-ancestors): the page steps aside and offers itself in its own window.
  const [framed, setFramed] = useState(false);
  useLayoutEffect(() => {
    try {
      setFramed(window.top !== window.self);
    } catch {
      setFramed(true);
    }
  }, []);

  // One page_view per page, client-side navigations included.
  useEffect(() => track("page_view", { page_path: pathname }), [pathname]);
  // Pictures kept on the device (public/sw.js): GitHub Pages lets a browser keep them ten minutes, and every deploy starts them over.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    whenIdle(() => void navigator.serviceWorker.register(assetUrl("/sw.js"), { scope: assetUrl("/") }).catch(() => {}));
  }, []);

  // The share sheet's code, fetched while idle: the first Share opens at once, and the page's first load doesn't carry it.
  useEffect(() => (hydrated ? whenIdle(() => void import("@/components/ShareSheet").catch(() => {})) : undefined), [hydrated]);

  // Leaving the shop area forgets where a product page was opened from;
  // any navigation closes the zoom view.
  useEffect(() => {
    useUiStore.getState().setZoom(null);
    useUiStore.getState().clearAdded();
    if (!/^\/shop(\/|$)/.test(pathname)) useUiStore.getState().setProductOrigin(null);
  }, [pathname]);

  // Another tab changed the saved session (a save, the bag…): reload it here
  // instead of overwriting it with this tab's stale copy on the next write.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => void syncFromStorage(e.key);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Rehydrate from localStorage on the client only (avoids SSR mismatch):
  // first move an old single-store session into the split stores, then load
  // both, then top the deck back up in case the dataset changed.
  useEffect(() => {
    // "From yours" (the mono-make store) loads apart, so its code isn't on every page; its script is
    // asked for now, alongside the catalog, not after it (two more round trips before the first card).
    const makeStore = import("@/store/makeStore");
    makeStore.catch(() => {});
    // Stored state is checked against the catalog, so it loads after it.
    void catalogReady()
      .then(async () => {
        try {
          migrateLegacySession();
          removeRetiredKeys();
          await Promise.all([useTasteStore.persist.rehydrate(), useCartStore.persist.rehydrate(), makeStore.then((m) => m.useMakeStore.persist.rehydrate())]);
          useTasteStore.getState().fillDeck();
        } catch (e) {
          // One bad stored value mustn't leave every button disabled: the page carries on with what did load.
          track("app_error", { where: "rehydrate", message: String(e).slice(0, 120) });
        } finally {
          useUiStore.getState().setHydrated();
        }
        // Uploads: a bag line whose file is gone from this device leaves the bag; old rasters go.
        void import("@/lib/upload/prune").then((m) => m.pruneUploads()).catch(() => {});
      })
      .catch(() => {
        /* the index didn't load: CatalogGate says so */
      });

    // A friend's taste link (/?taste=…): kept for this session so the taste
    // test can end with "Compare with a friend"; removed from the address bar.
    try {
      const q = new URLSearchParams(window.location.search);
      const code = q.get("taste") ?? sessionStorage.getItem("mono-friend-taste");
      const friend = decodeTaste(code);
      if (friend && code) {
        sessionStorage.setItem("mono-friend-taste", code);
        useUiStore.setState({ friendTaste: friend });
      }
      if (q.has("taste")) updateQuery((p) => p.delete("taste"));
    } catch {
      /* storage unavailable */
    }

    // Debug panel is opt-in: ?debug=1 (remembered for the tab).
    try {
      const param = new URLSearchParams(window.location.search).get("debug");
      if (param === "1") useUiStore.getState().setDebug(true);
      else if (param === "0") useUiStore.getState().setDebug(false);
      else if (sessionStorage.getItem("mono-debug") === "1") useUiStore.setState({ debug: true });
    } catch {
      /* storage unavailable */
    }
  }, []);

  if (framed)
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#0a0a0a] p-6 text-center" data-framed>
        <a href={typeof window === "undefined" ? "/" : window.location.href} target="_top" rel="noopener" className="text-sm font-medium text-white underline underline-offset-4">
          Open MONO
        </a>
      </div>
    );

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#0a0a0a]" data-hydrated={hydrated ? "" : undefined}>
      <Header />
      {/* The header floats over the top of main (it slides away with a
          transform, never by changing the layout); main keeps its space.
          Pages that hide it on scroll let their scroller reach under it. */}
      <main className="relative flex min-h-0 flex-1 flex-col pt-[var(--header-h)]">
        {/* Pages read the catalog: until its index has arrived, React keeps
            the server-rendered HTML and hydrates them once it's there. */}
        <Suspense fallback={null}>
          <CatalogGate>{children}</CatalogGate>
        </Suspense>
      </main>
      {/* In the layout's flow at the bottom: nothing ever sits behind it. */}
      <TabBar />
      {debug && (
        <Suspense fallback={null}>
          <AlgoDebugPanel />
        </Suspense>
      )}
      {shareLoaded && (
        <Suspense fallback={null}>
          <ShareSheet />
        </Suspense>
      )}
      {offerOpen && (
        <Suspense fallback={null}>
          <OfferSheet />
        </Suspense>
      )}
      <MiniBag />
      <Toast />
    </div>
    </MotionConfig>
  );
}

export { useHydrated } from "@/store/useUiStore";
