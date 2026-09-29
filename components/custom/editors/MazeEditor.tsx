"use client";

import { useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { MAZE_LEVELS, MAZE_LEVEL_NAMES, MAZE_MAX, PRODUCT, dotted, mazeInitials, mazeProblem, type MazeLevel, type Params } from "@/lib/custom/specs/maze";
import { Field, useLexicon } from "./Field";
import { Segmented, Switch } from "./Segmented";
import { useReportSpec } from "./useReportSpec";
import { INPUT, type EditorProps } from "./types";

/** Your Maze: the initials, how hard, whether the way through is drawn. */
export default function MazeEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "maze" ? (arrival.p as Params) : null;
  const start = a ?? PRODUCT.example;
  const [typed, setTyped] = useState(dotted(start.x));
  const [d, setD] = useState<MazeLevel>(start.d);
  const [solved, setSolved] = useState(a?.s === 1);
  const lex = useLexicon(!!typed.trim());

  const x = mazeInitials(typed);
  const problem = x ? mazeProblem(typed) : touched ? "Type your initials" : null;
  const refused = x && !problem && lex ? lex.wordsProblem(x) : null;
  const error = problem ?? refused;
  const spec: CustomSpec | null = x && !error && lex ? { t: "maze", v: 1, p: { x, d, ...(solved ? { s: 1 as const } : {}) } } : null;

  useReportSpec(spec, onChange);

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
    </>
  );
}
