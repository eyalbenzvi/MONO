"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { MAZE_LEVELS, MAZE_LEVEL_NAMES, MAZE_MAX, PRODUCT, dotted, mazeInitials, mazeProblem, type MazeLevel, type Params } from "@/lib/custom/specs/maze";
import { Field, WordsField, useLexicon, useWords } from "./Field";
import { Segmented, Switch } from "./Segmented";
import { INPUT, type EditorProps } from "./types";

/** Your Maze: the initials, how hard, whether the way through is drawn, the words. */
export default function MazeEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "maze" ? (arrival.p as Params) : null;
  const start = a ?? PRODUCT.example;
  const [typed, setTyped] = useState(dotted(start.x));
  const [d, setD] = useState<MazeLevel>(start.d);
  const [solved, setSolved] = useState(a?.s === 1);
  const words = useWords(a?.w ?? "");
  const lex = useLexicon(!!typed.trim());

  const x = mazeInitials(typed);
  const problem = x ? mazeProblem(typed) : touched ? "Type your initials" : null;
  const refused = x && !problem && lex ? lex.wordsProblem(x) : null;
  const error = problem ?? refused;
  const w = words.value;
  const spec: CustomSpec | null = x && !error && lex && w !== null ? { t: "maze", v: 1, p: { x, d, ...(solved ? { s: 1 as const } : {}), ...(w ? { w } : {}) } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <>
      <Field label="Initials" hint={`up to ${MAZE_MAX}`} error={error} htmlFor="make-maze-initials">
        <input
          id="make-maze-initials"
          value={typed}
          maxLength={MAZE_MAX * 3}
          placeholder="N.B."
          autoComplete="off"
          autoCapitalize="characters"
          onChange={(e) => setTyped(e.target.value)}
          aria-invalid={!!error}
          className={`${INPUT} font-mono uppercase`}
        />
      </Field>
      <Segmented label="How hard" options={MAZE_LEVELS} value={d} onChange={setD} format={(v) => MAZE_LEVEL_NAMES[v]} />
      <Switch label="Show the way through" checked={solved} onChange={setSolved} />
      <WordsField words={words} hint={made.wordsHint ?? PRODUCT.wordsHint ?? ""} touched={touched} />
    </>
  );
}
