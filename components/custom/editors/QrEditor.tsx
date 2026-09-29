"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { LINK_MAX, PRODUCT, linkOk, linkProblem, linkUrl, tidyLink, type Params } from "@/lib/custom/specs/qr";
import { Field, WordsField, useLexicon, useWords } from "./Field";
import { INPUT, type EditorProps } from "./types";

/**
 * Your Link: the web address and the words. Nothing is fetched or checked
 * online: the address is encoded on this device as typed, and the preview
 * scans, so the customer can try it with their own phone.
 */
export default function QrEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "qr" ? (arrival.p as Params) : null;
  const start = a ?? PRODUCT.example;
  const [typed, setTyped] = useState(start.h ? linkUrl(start) : start.a);
  const words = useWords(a?.w ?? "");
  const lex = useLexicon(!!typed.trim());

  const { a: addr, http } = tidyLink(typed);
  const problem = addr ? linkProblem(typed) : touched ? "Type a web address" : null;
  // The address prints, so its words go through the lexicon too ("n1ke.com" names a brand).
  const refused = addr && !problem && lex ? lex.wordsProblem(addr) : null;
  const error = problem ?? refused;
  const w = words.value;
  const spec: CustomSpec | null =
    addr && !error && linkOk(addr) && lex && w !== null ? { t: "qr", v: 1, p: { a: addr, ...(http ? { h: 1 as const } : {}), ...(w ? { w } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <>
      <Field label="Web address" hint={`up to ${LINK_MAX} characters`} error={error} htmlFor="make-qr-link">
        <input
          id="make-qr-link"
          value={typed}
          maxLength={LINK_MAX + 8}
          placeholder="example.org/for-noa"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setTyped(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="make-qr-note"
          className={`${INPUT} font-mono`}
        />
      </Field>
      <p id="make-qr-note" className="text-xs text-neutral-500">
        {spec ? `Scans as ${linkUrl({ a: addr, h: http ? 1 : undefined })}. ` : ""}
        Nothing is looked up online: point your phone at the preview to try it. Most phone cameras read the white-on-black code too.
      </p>
      <WordsField words={words} hint={made.wordsHint ?? PRODUCT.wordsHint ?? ""} touched={touched} />
    </>
  );
}
