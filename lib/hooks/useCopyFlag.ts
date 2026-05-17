/**
 * useCopyFlag — shared "copy success" state hook.
 *
 * Provides a 2-second auto-reset boolean that components use to swap a Copy
 * icon for a Check icon after a successful clipboard write.
 *
 * Extracted from seven individual tool components to keep the 2-second timeout
 * value and the reset logic in a single place. Both `trigger` and `reset` are
 * stable (wrapped in useCallback with no changing deps) so components can
 * safely include them in their own useCallback/useEffect dependency arrays.
 *
 * `reset` is exposed separately so components can clear the flag immediately
 * when the user switches modes (e.g. encode → decode) without waiting for the
 * auto-reset timeout.
 */

"use client";

import { useCallback, useState } from "react";

export function useCopyFlag() {
  const [isCopied, setIsCopied] = useState(false);

  const trigger = useCallback(() => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, []);

  const reset = useCallback(() => setIsCopied(false), []);

  return { isCopied, trigger, reset };
}
