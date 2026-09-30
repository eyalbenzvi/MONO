"use client";

import { useMemo, useState } from "react";
import { encodeMoves, readPgn, type Game } from "@/lib/custom/draw/chess";
import { FIRST_YEAR, LAST_YEAR, cleanWords, parseDate, type CustomSpec } from "@/lib/custom/spec";
import { packInts } from "@/lib/custom/specKit";
import { CHESS_MAX_PLIES, PLAYER_MAX, PRODUCT, RESULTS, type ChessResult, type Params } from "@/lib/custom/specs/chess";
import { replay } from "@/lib/custom/templates/chess";
import { Field, nameLine, useLexicon } from "./Field";
import { Segmented } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

const TEXTAREA = "w-full resize-none rounded-control bg-white/[0.06] px-3 py-2 font-mono text-sm text-white ring-1 ring-white/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white";
const RESULT_OPTIONS = ["", ...RESULTS] as const;
const RESULT_LABEL: Record<(typeof RESULT_OPTIONS)[number], string> = { "": "None", "1-0": "1–0", "0-1": "0–1", "1/2": "Draw" };

/** A spec's moves written back as SAN, numbered: what the game box shows for a print from a link or the example. */
function movesText(p: Params): string {
  return replay(p)
    .sans.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s))
    .join(" ");
}

/** A name field's words: the printed name, or null with the reason. */
function nameOf(text: string, lex: ReturnType<typeof useLexicon>) {
  const t = text.trim();
  const clean = t ? cleanWords(t, PLAYER_MAX) : undefined;
  const error = t && clean === null ? nameLine(t, PLAYER_MAX) : clean && lex ? lex.wordsProblem(clean) : null;
  return { value: t ? (error || !lex ? null : clean) : undefined, error };
}

/** Your Game: the game (a PGN pasted, read and checked here), the players, the day, the result. */
export default function ChessEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "chess" ? arrival.p : PRODUCT.example;
  const [pgn, setPgn] = useState(() => movesText(a));
  const [white, setWhite] = useState(a.a ?? "");
  const [black, setBlack] = useState(a.b ?? "");
  const [date, setDate] = useState(a.d ?? "");
  const [result, setResult] = useState<ChessResult | "">(a.r ?? "");
  const lex = useLexicon(!!(white.trim() || black.trim()));
  const w = nameOf(white, lex), b = nameOf(black, lex);

  const read = useMemo(() => (pgn.trim() ? readPgn(pgn, CHESS_MAX_PLIES) : null), [pgn]);
  const game: Game | null = read && "game" in read ? read.game : null;
  const gameError = !pgn.trim() ? (touched ? "Paste the game’s moves" : null) : read && "error" in read ? read.error : null;
  const dateOk = !date || !!parseDate(date);

  // A pasted game brings its players, day and result.
  const paste = (text: string) => {
    setPgn(text);
    const r = text.trim() ? readPgn(text, CHESS_MAX_PLIES) : null;
    if (!r || !("game" in r)) return;
    const g = r.game;
    if (g.white) setWhite(g.white);
    if (g.black) setBlack(g.black);
    if (g.date) setDate(g.date);
    if (g.result) setResult(g.result);
  };

  let spec: CustomSpec | null = null;
  if (game && w.value !== null && b.value !== null && dateOk) {
    const under = game.moves.flatMap((m, i) => (m.promo && m.promo !== "q" ? [i, { n: 1, b: 2, r: 3 }[m.promo]] : []));
    spec = {
      t: "chess",
      v: 1,
      p: {
        m: encodeMoves(game.moves),
        ...(under.length ? { u: packInts(under) } : {}),
        ...(w.value ? { a: w.value } : {}),
        ...(b.value ? { b: b.value } : {}),
        ...(date ? { d: date } : {}),
        ...(result ? { r: result } : {}),
      },
    };
  }

  useReportSpec(spec, onChange);

  const moves = game ? Math.ceil(game.moves.length / 2) : 0;
  return (
    <>
      <Field label="The game" hint="PGN, or just the moves" error={gameError} htmlFor="make-chess-pgn">
        <textarea id="make-chess-pgn" value={pgn} rows={5} spellCheck={false} placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6" onChange={(e) => paste(e.target.value)} aria-invalid={!!gameError} className={TEXTAREA} />
      </Field>
      {game && (
        <p className="-mt-2 text-xs text-neutral-400" role="status">
          {moves} {moves === 1 ? "move" : "moves"}
          {game.cut ? `. The first ${CHESS_MAX_PLIES / 2} are kept.` : "."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="White" hint="optional" error={w.error} htmlFor="make-chess-white">
          <input id="make-chess-white" value={white} maxLength={PLAYER_MAX + 12} autoComplete="off" onChange={(e) => setWhite(e.target.value)} aria-invalid={!!w.error} className={INPUT} />
        </Field>
        <Field label="Black" hint="optional" error={b.error} htmlFor="make-chess-black">
          <input id="make-chess-black" value={black} maxLength={PLAYER_MAX + 12} autoComplete="off" onChange={(e) => setBlack(e.target.value)} aria-invalid={!!b.error} className={INPUT} />
        </Field>
      </div>
      <Field label="The day" hint="optional" error={dateOk ? null : `Between ${FIRST_YEAR} and ${LAST_YEAR}.`} htmlFor="make-chess-date">
        <input id="make-chess-date" type="date" min={`${FIRST_YEAR}-01-01`} max={`${LAST_YEAR}-12-31`} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!dateOk} className={INPUT} />
      </Field>
      <Segmented label="Result" options={RESULT_OPTIONS} value={result} onChange={setResult} format={(r) => RESULT_LABEL[r]} />
    </>
  );
}
