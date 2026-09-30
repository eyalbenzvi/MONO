import { useCallback, useEffect, useRef, useState } from "react";

/** How long a button says "Added" before it's itself again. */
export const ADDED_FLASH_MS = 2500;

/**
 * A state that lasts a moment and ends by itself (a button's "Added"):
 * `[value, flash]`. Flashing again restarts the moment; nothing fires after
 * the component has gone.
 */
export function useFlash<T = true>(ms = ADDED_FLASH_MS): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback(
    (v: T) => {
      clearTimeout(timer.current);
      setValue(() => v);
      timer.current = setTimeout(() => setValue(null), ms);
    },
    [ms],
  );
  return [value, flash];
}
