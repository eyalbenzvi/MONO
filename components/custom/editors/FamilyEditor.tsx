"use client";

import { useEffect } from "react";
import type { EditorProps } from "./types";

/** Placeholder: this product isn't built yet. */
export default function FamilyEditor({ onChange }: EditorProps) {
  useEffect(() => onChange({ spec: null }), [onChange]);
  return null;
}
