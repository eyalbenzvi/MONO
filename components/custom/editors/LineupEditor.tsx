"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomSpec } from "@/lib/custom/spec";
import { FORMATIONS, FORMATION_NAMES, PLAYER_MAX, POSITIONS, PRODUCT, SEASON_MAX, TEAM_MAX, type Formation, type Player } from "@/lib/custom/specs/lineup";
import { Field, useLexicon } from "./Field";
import { RowsField, type Row } from "./RowsField";
import { Stepper, Switch } from "./Segmented";
import { TextField, allOk, checkText, useText } from "./TextField";
import { INPUT, type EditorProps } from "./types";

/** Rows for a formation: the ones typed kept in order, blanks after. */
const resize = (rows: Row[], n: number): Row[] => Array.from({ length: n }, (_, i) => rows[i] ?? { n: "", k: "" });

/** Your Line-up: the formation, the team and the season, a name and a number at each position; and for the whole team, one print a player. */
export default function LineupEditor({ arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "lineup" ? arrival.p : null;
  const ex = PRODUCT.example;
  const lex = useLexicon(true);
  const [f, setF] = useState<Formation>(a?.f ?? "442");
  const team = useText(a?.t ?? "", TEAM_MAX, lex, { required: "Add the team.", touched });
  const season = useText(a?.s ?? "", SEASON_MAX, lex);
  const [rows, setRows] = useState<Row[]>(a ? a.x.map(([n, k]) => ({ n, k: k === undefined ? "" : String(k) })) : resize([], POSITIONS["442"].length));
  const [whole, setWhole] = useState(false);
  const n = POSITIONS[f].length;
  const shown = resize(rows, n);
  const [count, setCount] = useState(n);
  const cells = shown.map((r) => ({ n: checkText(r.n, PLAYER_MAX, lex), k: r.k.trim() ? (/^\d{1,2}$/.test(r.k.trim()) ? Number(r.k.trim()) : null) : undefined }));
  const errors = cells.map((c) => ({ n: c.n.error, k: c.k === null ? "0 to 99" : null }));
  const ok = allOk(lex, team, season) && !!team.value && cells.every((c) => c.n.value !== null && c.k !== null);
  const x: Player[] = cells.map((c) => (c.k !== undefined ? [c.n.value ?? "", c.k as number] : [c.n.value ?? ""]));
  // A shirt of a whole team, reopened from the bag, keeps its player's mark while that position is still there.
  const me = a?.me !== undefined && a.me < x.length ? { me: a.me } : {};
  const spec: CustomSpec | null = ok ? { t: "lineup", v: 1, p: { f, t: team.value!, ...(season.value ? { s: season.value } : {}), x, ...(whole ? {} : me) } } : null;
  const take = Math.min(count, n);
  const batch = spec && whole ? Array.from({ length: take }, (_, i) => ({ ...spec, p: { ...spec.p, me: i } }) as CustomSpec) : undefined;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify([spec, batch?.length ?? 0]) : "";
  useEffect(() => {
    report.current(key ? { spec: JSON.parse(key)[0] as CustomSpec, ...(batch ? { batch } : {}) } : { spec: null });
    // batch follows the key (the spec and how many).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <>
      <Field label="Formation" htmlFor="make-lineup-formation">
        <select id="make-lineup-formation" value={f} onChange={(e) => setF(e.target.value as Formation)} className={INPUT}>
          {FORMATIONS.map((v) => (
            <option key={v} value={v}>
              {FORMATION_NAMES[v]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <TextField id="make-lineup-team" label="Team" state={team} max={TEAM_MAX} placeholder={ex.t} />
        <TextField id="make-lineup-season" label="Season" hint="optional" state={season} max={SEASON_MAX} placeholder={ex.s} />
      </div>
      <p className="text-xs text-neutral-400">{f === "bb" ? "Player 1 is the centre; then the forwards and the guards." : "Player 1 is in goal; then the backs, the midfield and the forwards, left to right."}</p>
      <RowsField
        id="make-lineup"
        noun="player"
        columns={[
          { key: "n", label: "Player", max: PLAYER_MAX },
          { key: "k", label: "No.", width: "4rem" },
        ]}
        rows={shown}
        setRows={setRows}
        min={n}
        max={n}
        errors={errors}
        placeholders={ex.x.map(([nm, k]) => ({ n: nm, k: k === undefined ? "" : String(k) }))}
      />
      <Switch label="For the whole team" checked={whole} onChange={setWhole} />
      {whole && (
        <>
          <Stepper label="How many tees" value={take} min={1} max={n} onChange={setCount} />
          <p className="text-xs text-neutral-400">One tee a player, from the top of the list, each marking its own name. Each is its own line in the bag, so each can have its own size.</p>
        </>
      )}
    </>
  );
}
