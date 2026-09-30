"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useHistorySheet } from "@/hooks/useHistorySheet";

/** Sheets open and close in 250 ms, on the one easing. */
export const SHEET_MOTION = { duration: 0.25, ease: [0.2, 0, 0, 1] } as const;
/** Dragged down past this (px), or flung faster than DISMISS_VELOCITY, a sheet closes. */
const DISMISS_OFFSET = 100;
const DISMISS_VELOCITY = 500;

interface SheetNav {
  /** Close through the history (X, backdrop, Escape, Back). */
  close: () => void;
  /** Go to another page from inside the sheet (its history entry becomes that page). */
  navigate: (href: string) => void;
}
const SheetContext = createContext<SheetNav | null>(null);
/** Inside a Sheet: close it, or leave it for another page. */
export const useSheet = () => useContext(SheetContext);

/**
 * The one bottom sheet: in a portal on the body (above the header, never
 * under a backdrop), a real grabber to drag it away, the X for everyone who
 * doesn't drag, the primary action pinned at the bottom (`footer`), focus
 * held inside, and Back closes it (`historyKey`, see useHistorySheet).
 */
export function Sheet({
  open,
  onClose,
  historyKey,
  label,
  title,
  footer,
  describedBy,
  labelledBy,
  returnTo,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Its step in the history (#key): Back closes it. */
  historyKey?: string;
  /** Accessible name when there's no visible title. */
  label?: string;
  title?: React.ReactNode;
  /** The primary action, pinned at the bottom within the thumb. */
  footer?: React.ReactNode;
  describedBy?: string;
  /** A heading of the content's own that names the sheet (instead of `title`). */
  labelledBy?: string;
  /** Where focus goes when the sheet closes and nothing was focused before. */
  returnTo?: () => HTMLElement | null | undefined;
  className?: string;
  children?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const nav = useHistorySheet(historyKey, open, onClose);
  const panel = useRef<HTMLDivElement>(null);
  // Once mounted: a sheet first rendered already open has no panel on its first pass.
  useFocusTrap(panel, open && mounted, nav.close, returnTo);
  const drag = useDragControls();
  const titleId = useRef(`sheet-${Math.random().toString(36).slice(2, 8)}`).current;
  if (!mounted) return null;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) nav.close();
  };

  return createPortal(
    <SheetContext.Provider value={nav}>
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="backdrop" className="fixed inset-0 z-backdrop bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SHEET_MOTION} onClick={nav.close} />
            <motion.div
              key="sheet"
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label={title || labelledBy ? undefined : label}
              aria-labelledby={title ? titleId : labelledBy}
              aria-describedby={describedBy}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SHEET_MOTION}
              drag="y"
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={onDragEnd}
              className={`fixed inset-x-0 bottom-0 z-sheet mx-auto flex max-h-[90dvh] max-w-lg flex-col rounded-t-sheet bg-ink-900 ring-1 ring-white/10 ${className}`}
            >
              {/* The grabber: drag it (or the header) down to close. */}
              <div className="flex shrink-0 touch-none cursor-grab flex-col" onPointerDown={(e) => drag.start(e)}>
                <div className="flex justify-center pb-1 pt-2" aria-hidden>
                  <span className="h-1 w-10 rounded-full bg-white/25" />
                </div>
                <div className="flex min-h-11 items-start justify-between gap-3 pl-4 pr-2">
                  {title ? (
                    <h2 id={titleId} className="min-w-0 flex-1 pt-2.5 text-base font-medium">
                      {title}
                    </h2>
                  ) : (
                    <span />
                  )}
                  <button type="button" onClick={nav.close} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center text-neutral-300 hover:text-white">
                    <Icon name="x" className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
              {footer && <div className="shrink-0 border-t border-white/10 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">{footer}</div>}
              {!footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </SheetContext.Provider>,
    document.body,
  );
}
