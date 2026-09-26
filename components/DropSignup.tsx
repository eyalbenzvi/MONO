"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { apiConfigured, isEmail, localEmail, signup, type SignupSource } from "@/lib/api";
import { useTasteStore } from "@/store/tasteStore";

/**
 * Quiet email capture for new drops that match your taste (no popup; it
 * sits in the flow). Honest about where the address goes: to the API when
 * one is configured, otherwise it's only remembered in this browser.
 */
export function DropSignup({ source, className = "" }: { source: SignupSource; className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error" | "server" | "device">("idle");
  const [known, setKnown] = useState<string | null>(null);
  useEffect(() => setKnown(apiConfigured ? null : localEmail()), []);

  if (known && state === "idle") {
    return (
      <p className={`mt-6 flex items-center justify-center gap-1.5 text-xs text-neutral-400 ${className}`}>
        <Check className="h-3.5 w-3.5" /> New matching drops: we&apos;ll remember {known} on this device.
      </p>
    );
  }
  if (state === "server" || state === "device") {
    return (
      <p role="status" className={`mt-6 flex items-center justify-center gap-1.5 text-sm text-neutral-300 ${className}`}>
        <Check className="h-4 w-4" /> {state === "server" ? "You're on the list." : "We'll remember you on this device."}
      </p>
    );
  }
  return (
    <form
      className={`mt-6 w-full text-left ${className}`}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!isEmail(email)) return setState("error");
        setState("busy");
        const r = await signup(email, source, useTasteStore.getState().preferenceVector);
        setState(r.ok ? r.stored : "error");
      }}
    >
      <label htmlFor={`drop-${source}`} className="block text-sm font-semibold">
        Save your taste · get new tees that match you
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={`drop-${source}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="send"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          aria-invalid={state === "error"}
          aria-describedby={state === "error" ? `drop-${source}-err` : undefined}
          className={`h-11 min-w-0 flex-1 rounded-xl bg-white/[0.05] px-3 text-sm text-white outline-none placeholder:text-neutral-600 ${
            state === "error" ? "ring-2 ring-white" : "ring-1 ring-white/10 focus:ring-white/50"
          }`}
        />
        <button type="submit" disabled={state === "busy"} className="h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-bold text-black disabled:opacity-50">
          Notify me
        </button>
      </div>
      {state === "error" && (
        <p id={`drop-${source}-err`} role="alert" className="mt-1.5 text-xs font-medium text-white">
          ! Enter a valid email
        </p>
      )}
      <p className="mt-1.5 text-xs text-neutral-400">{apiConfigured ? "Only new drops. Unsubscribe any time." : "Kept on this device only — nothing is sent anywhere."}</p>
    </form>
  );
}
