"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Link2, Loader2, Mail, MessageSquare, Send, Share2, X } from "lucide-react";
import { getShirtById } from "@/lib/catalog";
import { channelLink, productShareUrl, shareFileName, shareMessage, shareTitle, type ShareChannel } from "@/lib/share";
import { renderShareImage, type ShareFormat } from "@/lib/shareImage";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useUiStore } from "@/store/useUiStore";
import { COLOR_LABELS, COLORS, type BaseColor, type ShirtProduct } from "@/types/shirt";
import { track } from "@/lib/analytics";

/* Monochrome platform glyphs (24×24), drawn to match the UI's line icons. */
const glyph = (children: React.ReactNode, filled = false) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const GLYPHS: Partial<Record<ShareChannel, React.ReactNode>> = {
  whatsapp: glyph(
    <>
      <path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2Z" />
      <path d="M9 8.3c.3-.4.8-.4 1 0l.8 1.6c.1.3 0 .6-.2.8l-.5.5c.5 1.2 1.4 2.1 2.6 2.6l.5-.5c.2-.2.5-.3.8-.2l1.6.8c.4.2.4.7 0 1-.6.7-1.5 1-2.4.7a7.5 7.5 0 0 1-4.9-4.9c-.3-.9 0-1.8.7-2.4Z" fill="currentColor" stroke="none" />
    </>,
  ),
  instagram: glyph(
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </>,
  ),
  facebook: glyph(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M13.2 20.8v-7h2.3l.4-2.7h-2.7V9.5c0-.8.3-1.3 1.4-1.3h1.4V5.8a17 17 0 0 0-2.1-.1c-2.1 0-3.4 1.2-3.4 3.5v1.9H8.2v2.7h2.3v7" />
    </>,
  ),
  tiktok: glyph(
    <>
      <path d="M14.5 3.5v11a3.8 3.8 0 1 1-3.8-3.8" />
      <path d="M14.5 3.5c.4 2.6 2.4 4.5 5 4.7" />
    </>,
  ),
  x: glyph(<path d="M4.5 4h4.2l10.8 16h-4.2L4.5 4Zm14.5 0-5.7 6.6M10.7 13.4 5 20" />),
};

const CHANNELS: { id: ShareChannel; label: string; icon: React.ReactNode }[] = [
  { id: "whatsapp", label: "WhatsApp", icon: GLYPHS.whatsapp },
  { id: "instagram", label: "Instagram", icon: GLYPHS.instagram },
  { id: "facebook", label: "Facebook", icon: GLYPHS.facebook },
  { id: "tiktok", label: "TikTok", icon: GLYPHS.tiktok },
  { id: "telegram", label: "Telegram", icon: <Send className="h-6 w-6" /> },
  { id: "x", label: "X", icon: GLYPHS.x },
  { id: "email", label: "Email", icon: <Mail className="h-6 w-6" /> },
  { id: "sms", label: "Message", icon: <MessageSquare className="h-6 w-6" /> },
  { id: "copy", label: "Copy link", icon: <Link2 className="h-6 w-6" /> },
  { id: "download", label: "Save image", icon: <Download className="h-6 w-6" /> },
];

const HOW_TO: Partial<Record<ShareChannel, string>> = {
  instagram: "Image saved and link copied. In Instagram: tap + → Story, pick the image, then add a Link sticker and paste.",
  tiktok: "Image saved and link copied. In TikTok: tap + → Upload, pick the image, and paste the link in the caption.",
};

// Generated images are reused while the page lives (same tee, colour, format).
const cache = new Map<string, Promise<Blob>>();
const imageFor = (shirt: ShirtProduct, color: BaseColor, format: ShareFormat) => {
  const key = `${shirt.id}|${color}|${format}`;
  if (!cache.has(key)) {
    const p = renderShareImage(shirt, color, format);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key)!;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure contexts: a selected textarea + execCommand.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ShareSheet() {
  const share = useUiStore((s) => s.share);
  const close = useUiStore((s) => s.closeShare);
  const shirt = share ? getShirtById(share.id) : undefined;
  return <AnimatePresence>{share && shirt && <Sheet key={shirt.id} shirt={shirt} initialColor={share.color} onClose={close} />}</AnimatePresence>;
}

function Sheet({ shirt, initialColor, onClose }: { shirt: ShirtProduct; initialColor: BaseColor; onClose: () => void }) {
  const showToast = useUiStore((s) => s.showToast);
  const [color, setColor] = useState<BaseColor>(initialColor);
  const [format, setFormat] = useState<ShareFormat>("story");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onClose);

  // Render the image as soon as the sheet opens (and on colour / format
  // change), so the File is ready when the user taps: navigator.share must
  // run within the tap's user activation, before any slow await.
  useEffect(() => {
    let live = true;
    setBlob(null);
    setFailed(false);
    imageFor(shirt, color, format).then(
      (b) => live && setBlob(b),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [shirt, color, format]);

  const preview = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const file = useMemo(() => (blob ? new File([blob], shareFileName(shirt, color, format), { type: "image/png" }) : null), [blob, shirt, color, format]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const canShareFiles = !!file && canShare && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const nativeShare = async (ref: ShareChannel, withFile: boolean) => {
    const url = productShareUrl(shirt, color, ref);
    track("share", { id: shirt.id, channel: ref, color, format, withImage: withFile });
    try {
      if (withFile && file) await navigator.share({ files: [file], title: shareTitle(shirt), text: `${shareMessage(shirt, color)}\n${url}` });
      else await navigator.share({ title: shareTitle(shirt), text: shareMessage(shirt, color), url });
      return true;
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") showToast("Couldn't open the share menu");
      return false;
    }
  };

  const act = async (ch: ShareChannel) => {
    setHint(null);
    if (!(ch === "instagram" || ch === "tiktok") || !canShareFiles) track("share", { id: shirt.id, channel: ch, color, format });
    const url = productShareUrl(shirt, color, ch);
    if (ch === "copy") {
      showToast((await copyText(url)) ? "Link copied" : "Couldn't copy the link");
      return;
    }
    if (ch === "download") {
      if (blob) downloadBlob(blob, shareFileName(shirt, color, format));
      showToast("Image saved");
      return;
    }
    if (ch === "instagram" || ch === "tiktok") {
      // No web intent: the share sheet with the image reaches the app on phones.
      if (canShareFiles) {
        await nativeShare(ch, true);
        return;
      }
      if (blob) downloadBlob(blob, shareFileName(shirt, color, format));
      await copyText(url);
      setHint(HOW_TO[ch]!);
      return;
    }
    const link = channelLink(ch, shirt, color);
    if (!link) return;
    if (link.startsWith("mailto:") || link.startsWith("sms:")) window.location.href = link;
    else window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/70" />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${shirt.title}`}
        className="relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-ink-900 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 ring-1 ring-white/10 sm:rounded-[28px]"
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Share this tee</h2>
            <p className="truncate text-sm text-neutral-400">{shirt.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close share" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/15">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview + options */}
        <div className="mt-4 flex gap-4">
          <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 ${format === "story" ? "h-[196px] w-[110px]" : "h-[150px] w-[150px]"}`}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Share image preview" className="h-full w-full object-cover" />
            ) : failed ? (
              <span className="px-2 text-center text-xs text-neutral-400">Preview unavailable</span>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-neutral-500" aria-label="Preparing image" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">Tee</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Tee colour">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    onClick={() => setColor(c)}
                    className={`flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium ring-1 ${color === c ? "bg-white text-black ring-white" : "text-neutral-300 ring-white/15"}`}
                  >
                    <span className={`h-4 w-4 rounded-full ${c === "black" ? "bg-black ring-1 ring-white/60" : "bg-white ring-1 ring-black/20"}`} />
                    {COLOR_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">Image</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Image format">
                {(["story", "square"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={format === f}
                    onClick={() => setFormat(f)}
                    className={`h-10 rounded-full px-3.5 text-sm font-medium ring-1 ${format === f ? "bg-white text-black ring-white" : "text-neutral-300 ring-white/15"}`}
                  >
                    {f === "story" ? "Story" : "Post"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {canShare && (
          <button
            type="button"
            data-autofocus
            disabled={!file && !failed}
            onClick={() => nativeShare("native", canShareFiles)}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-[0.98] disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" /> Share…
          </button>
        )}

        <div className="mt-5 grid grid-cols-5 gap-x-1 gap-y-4">
          {CHANNELS.map((c) => (
            <button key={c.id} type="button" onClick={() => act(c.id)} disabled={(c.id === "download" || c.id === "instagram" || c.id === "tiktok") && !blob} className="group flex flex-col items-center gap-1.5 disabled:opacity-40">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 transition-colors group-hover:bg-white/20 group-active:scale-95">{c.icon}</span>
              <span className="text-[11px] leading-tight text-neutral-300">{c.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence>
          {hint && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-neutral-200 ring-1 ring-white/10" role="status">
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
