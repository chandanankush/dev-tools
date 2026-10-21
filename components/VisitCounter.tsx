"use client";

/**
 * Footer visitor count ("Visitors: 1,234").
 *
 * Counts unique browsers: the first visit POSTs to /api/visits and remembers that in
 * localStorage; later visits only GET the current number. The flag is written
 * *before* the POST so React Strict Mode's double-invoked effect cannot count twice,
 * and removed again if the request fails so the visit is retried next time.
 *
 * If localStorage is blocked we cannot remember anyone, so we only read — an
 * inflated count is worse than a missing one. The counter renders nothing until the
 * number is known, and stays hidden if the API is unavailable.
 */
import { useEffect, useState } from "react";

const STORAGE_KEY = "dt-visit-counted";

const formatter = new Intl.NumberFormat("en-US");

function hasCountedVisit(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function setCountedVisit(counted: boolean): void {
  try {
    if (counted) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable: nothing to remember
  }
}

export function VisitCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const isNewVisitor = !hasCountedVisit();
    if (isNewVisitor) setCountedVisit(true);

    fetch("/api/visits", {
      method: isNewVisitor ? "POST" : "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ count?: unknown }>;
      })
      .then((data) => {
        if (typeof data.count === "number") setCount(data.count);
      })
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        if (isNewVisitor) setCountedVisit(false);
      });

    return () => controller.abort();
  }, []);

  if (count === null) return null;

  return (
    <span aria-live="polite" className="text-[11px] text-muted-foreground">
      Visitors: {formatter.format(count)}
    </span>
  );
}
