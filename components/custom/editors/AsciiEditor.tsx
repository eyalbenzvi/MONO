"use client";

import { useMemo, useState } from "react";
import { cropBox, luminance, toneGrid } from "@/lib/custom/draw/asciiPicture";
import { ASCII_CHARS, ASCII_COLS, ASCII_FILLS, ASCII_MAX, ASCII_PHRASE, ASCII_ROWS, asciiPack, asciiPictureProblem, asciiUnpack, type AsciiCols, type AsciiFill, type CustomSpec } from "@/lib/custom/spec";
import { Field, WordsField, useLexicon, useWords } from "./Field";
import { Segmented, Switch } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** The big letters as lines: one line up to ASCII_MAX, else split at the space nearest the middle into two that fit, else null. */
export function asciiLines(text: string): string[] | null {
  const t = text.trim().toUpperCase().replace(/\s+/g, " ");
  if (!t) return null;
  if (t.length <= ASCII_MAX) return [t];
  const spaces = [...t].flatMap((c, i) => (c === " " ? [i] : [])).sort((a, b) => Math.abs(a - t.length / 2) - Math.abs(b - t.length / 2));
  for (const i of spaces) {
    const [a, b] = [t.slice(0, i), t.slice(i + 1)];
    if (a.length <= ASCII_MAX && b.length <= ASCII_MAX) return [a, b];
  }
  return null;
}

/** A picked photo, drawn at most SOURCE_LONG on its long side (all the grid ever needs), kept on the device only. */
const SOURCE_LONG = 600;
/** Pixels a character cell is averaged from. */
const CELL_PX = 4;
const PLACES = [0, 0.5, 1] as const;
const ZOOMS = [1, 1.5, 2.2] as const;
const ZOOM_LABEL: Record<(typeof ZOOMS)[number], string> = { 1: "Whole", 1.5: "Closer", 2.2: "Closest" };
const DETAIL_LABEL: Record<AsciiCols, string> = { 32: "Bold", 40: "Medium", 48: "Fine" };

async function readPicture(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, SOURCE_LONG / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = c.getContext("2d")!;
  // A transparent picture reads as on white paper.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

/** The picture's tones for a grid: the crop drawn at CELL_PX a cell, then toneGrid (lib/custom/draw/asciiPicture). */
function tones(src: HTMLCanvasElement, cols: AsciiCols, place: number, zoom: number, edges: boolean): number[] {
  const rows = ASCII_ROWS[cols];
  const [w, h] = [cols * CELL_PX, rows * CELL_PX];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  const b = cropBox(src.width, src.height, cols, rows, place, zoom);
  ctx.drawImage(src, b.sx, b.sy, b.sw, b.sh, 0, 0, w, h);
  return toneGrid(luminance(ctx.getImageData(0, 0, w, h).data), w, h, cols, rows, { edges });
}

const FILL_LABEL: Record<AsciiFill, string> = { self: "Its letters", "#": "#", "@": "@", "%": "%", "8": "8", $: "$", phrase: "A phrase" };

/**
 * Your ASCII: the big letters (one or two lines), what they're typed in, a drop shadow, your words; or a
 * picture from the device (never uploaded: only its tones go in the spec), its detail, crop and edges.
 */
export default function AsciiEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "ascii" ? arrival.p : null;
  const [mode, setMode] = useState<"words" | "picture">(a?.g ? "picture" : "words");
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [cols, setCols] = useState<AsciiCols>(a?.c ?? 40);
  const [place, setPlace] = useState<number>(0.5);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [edges, setEdges] = useState(false);
  const linked = useMemo(() => (a?.g && a.c ? asciiUnpack(a.g, a.c) : null), [a?.g, a?.c]);
  const levels = useMemo(() => (source ? tones(source, cols, place, zoom, edges) : linked && a?.c === cols ? linked : null), [source, cols, place, zoom, edges, linked, a?.c]);
  const pictureError = levels ? asciiPictureProblem(levels, cols) : touched && !fileError ? "Choose a picture" : null;
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setSource(await readPicture(file));
      setFileError(null);
    } catch {
      setFileError("This browser can’t open that file. Try a JPEG or a PNG.");
    }
  };
  const ex = made.example.t === "ascii" ? made.example.p : null;
  const [big, setBig] = useState((a ?? ex)?.x.join(" ") ?? "");
  const [fill, setFill] = useState<AsciiFill>(a?.f ?? "self");
  const [phrase, setPhrase] = useState(a?.p ?? "");
  const [shadow, setShadow] = useState((a ?? ex)?.s === 1);
  const words = useWords(a?.w ?? "");
  const lex = useLexicon(!!big.trim() || !!phrase.trim());

  const bad = [...big].find((ch) => !/\s/.test(ch) && !ASCII_CHARS.test(ch.toUpperCase()));
  const plain = bad?.normalize("NFKD").replace(/\p{M}/gu, "");
  const lines = bad ? null : asciiLines(big);
  const bigError = !big.trim()
    ? touched
      ? "Type a word or two"
      : null
    : bad
      ? `The pixel font has no "${bad}".${plain && plain !== bad && ASCII_CHARS.test(plain.toUpperCase()) ? ` Try "${plain.toUpperCase()}".` : ""}`
      : !lines
        ? `Up to ${ASCII_MAX} letters a line, two lines (a space breaks it)`
        : !lines.some((l) => /[A-Z0-9]/.test(l))
          ? "A letter or a figure, at least"
          : lex
            ? lex.wordsProblem(big)
            : null;
  const p = phrase.trim();
  const phraseError = fill === "phrase" && p ? (!ASCII_PHRASE.test(p) ? "Plain letters, figures and punctuation, up to 24" : lex ? lex.wordsProblem(p) : null) : fill === "phrase" && touched ? "Type the phrase the letters are typed in" : null;
  const w = words.value;
  const ok = lines && !bigError && lex && w !== null && (fill !== "phrase" || (p && !phraseError));
  const spec: CustomSpec | null =
    mode === "picture"
      ? levels && !pictureError && w !== null
        ? { t: "ascii", v: 1, p: { x: [], c: cols, g: asciiPack(levels), ...(w ? { w } : {}) } }
        : null
      : ok
        ? { t: "ascii", v: 1, p: { x: lines!, f: fill, ...(fill === "phrase" ? { p } : {}), ...(shadow ? { s: 1 as const } : {}), ...(w ? { w } : {}) } }
        : null;

  useReportSpec(spec, onChange);

  const wide = source ? source.width / source.height > (cols * 0.602) / (ASCII_ROWS[cols] * 1.02) : true;
  const picture = (
    <>
      <Field label="Your picture" hint="read on this device, never uploaded" error={fileError ?? pictureError} htmlFor="make-picture">
        <input id="make-picture" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className={`${INPUT} pt-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:text-xs file:font-semibold file:text-black`} />
      </Field>
      {source ? (
        <p className="text-xs text-neutral-400">Only the characters go in the print and the link.</p>
      ) : (
        linked && <p className="text-xs text-neutral-500">Showing the picture from the link. Choose one to use yours.</p>
      )}
      {source && (
        <>
          <Segmented label="Detail" options={ASCII_COLS} value={cols} onChange={setCols} format={(c) => DETAIL_LABEL[c]} />
          <Segmented label="Crop" options={ZOOMS} value={zoom} onChange={setZoom} format={(z) => ZOOM_LABEL[z]} />
          <Segmented label={wide ? "Across" : "Up and down"} options={PLACES} value={place as (typeof PLACES)[number]} onChange={setPlace} format={(t) => (t === 0.5 ? "Middle" : wide ? (t ? "Right" : "Left") : t ? "Bottom" : "Top")} />
          <Switch label="Sharper edges" checked={edges} onChange={setEdges} />
        </>
      )}
    </>
  );

  return (
    <>
      <Segmented label="Make it from" options={["words", "picture"] as const} value={mode} onChange={setMode} format={(m) => (m === "words" ? "Words" : "A picture")} />
      {mode === "picture" ? (
        picture
      ) : (
        <>
          <Field label="Big letters" hint={`up to ${ASCII_MAX} a line`} error={bigError} htmlFor="make-big">
            <input id="make-big" value={big} maxLength={2 * ASCII_MAX + 1} placeholder="NOA" autoComplete="off" autoCapitalize="characters" onChange={(e) => setBig(e.target.value)} aria-invalid={!!bigError} className={`${INPUT} font-mono uppercase`} />
          </Field>
          <Segmented label="Typed in" options={ASCII_FILLS} value={fill} onChange={setFill} format={(f) => FILL_LABEL[f]} />
          {fill === "phrase" && (
            <Field label="The phrase" error={phraseError} htmlFor="make-phrase">
              <input id="make-phrase" value={phrase} maxLength={24} placeholder="love from tel aviv" autoComplete="off" onChange={(e) => setPhrase(e.target.value)} aria-invalid={!!phraseError} className={`${INPUT} font-mono`} />
            </Field>
          )}
          <Switch label="Drop shadow" checked={shadow} onChange={setShadow} />
        </>
      )}
      <WordsField words={words} hint={made.wordsHint ?? ""} />
    </>
  );
}
