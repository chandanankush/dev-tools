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
