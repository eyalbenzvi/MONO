import { useUiStore } from "@/store/useUiStore";

export async function copyText(text: string) {
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

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The device share sheet when there is one (with the image, if the browser
 * can share files); otherwise save the image (if any), copy the link and say so.
 */
export async function shareOrCopy({ title, text, url, image }: { title: string; text: string; url: string; image?: { blob: Blob; name: string } }) {
  const file = image ? new File([image.blob], image.name, { type: "image/png" }) : null;
  const withFile = file && navigator.canShare?.({ files: [file] });
  if (navigator.share) {
    try {
      await navigator.share(withFile ? { title, text: `${text}\n${url}`, files: [file!] } : { title, text, url });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
  }
  if (image) downloadBlob(image.blob, image.name);
  const copied = await copyText(url);
  useUiStore.getState().showToast(copied ? (image ? "Image saved · link copied" : "Link copied") : "Couldn't copy the link");
}
