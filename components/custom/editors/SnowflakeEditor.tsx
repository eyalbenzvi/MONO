"use client";

import { useEffect, useRef, useState } from "react";
import { cleanWords, type CustomSpec } from "@/lib/custom/spec";
import { SNOWFLAKE_MAX } from "@/lib/custom/specs/snowflake";
import { Field, nameLine, useLexicon } from "./Field";
import { INPUT, type EditorProps } from "./types";

/** Your Snowflake: the name the crystal grows from (and is printed under it). */
export default function SnowflakeEditor({ made, arrival, touched, onChange }: EditorProps) {
  const a = arrival?.t === "snowflake" ? arrival.p : null;
  const [name, setName] = useState(a?.n ?? "");
  const lex = useLexicon(!!name.trim());
  const n = cleanWords(name, SNOWFLAKE_MAX);
  const refused = n && lex ? lex.wordsProblem(n) : null;
  const error = !name.trim() ? (touched ? "Type a name" : null) : !n ? nameLine(name, SNOWFLAKE_MAX) : refused;
  const spec: CustomSpec | null = n && lex && !refused ? { t: "snowflake", v: 1, p: { n } } : null;

  const report = useRef(onChange);
  report.current = onChange;
  const key = spec ? JSON.stringify(spec) : "";
  useEffect(() => {
    report.current({ spec: key ? (JSON.parse(key) as CustomSpec) : null });
  }, [key]);

  return (
    <Field label="A name" error={error} htmlFor="make-snowflake-name">
      <input id="make-snowflake-name" value={name} maxLength={SNOWFLAKE_MAX + 4} placeholder={made.wordsHint} autoComplete="off" onChange={(e) => setName(e.target.value)} aria-invalid={!!error} className={INPUT} />
    </Field>
  );
}
