/**
 * UuidGenerator — generates RFC 4122 v4 UUIDs in bulk.
 *
 * Uses the browser's built-in `crypto.randomUUID()` (available in all modern
 * browsers and in Node.js 14.17+) rather than a third-party library, so there
 * is no bundle size cost and the entropy comes directly from the OS CSPRNG.
 *
 * Count is capped at 100 in `createUuidList` — generating thousands of UUIDs
 * would produce an enormous textarea value with no practical benefit.
 *
 * `regenerate` is wrapped in `useCallback` so the `useEffect` dependency array
 * is stable: the effect only re-runs when `amount` changes, not on every render.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard } from "@/lib/clipboard";
import { useCopyFlag } from "@/lib/hooks/useCopyFlag";

function createUuidList(count: number) {
  return Array.from({ length: Math.min(count, 100) }, () => crypto.randomUUID());
}

export default function UuidGenerator() {
  const [amount, setAmount] = useState(5);
  const [uuids, setUuids] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { isCopied, trigger: triggerCopy, reset: resetCopy } = useCopyFlag();

  const regenerate = useCallback(() => {
    setUuids(createUuidList(amount));
    resetCopy();
    setError(null);
  }, [amount, resetCopy]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const copyAll = async () => {
    if (uuids.length === 0) return;
    setError(null);
    try {
      await copyToClipboard(uuids.join("\n"));
      triggerCopy();
    } catch (clipboardError) {
      setError((clipboardError as Error).message || "Unable to copy to clipboard.");
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="uuid-output">Generated UUIDs</Label>
            <Button
              type="button"
              variant="outline"
              disabled={uuids.length === 0}
              onClick={() => void copyAll()}
            >
              {isCopied ? "Copied!" : "Copy all"}
            </Button>
          </div>
          <Textarea
            id="uuid-output"
            readOnly
            value={uuids.join("\n")}
            className="min-h-[240px] font-mono text-sm"
          />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Count</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              max={100}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value) || 1)}
            />
          </div>
          <Button type="button" className="w-full" onClick={regenerate}>
            Generate UUIDs
          </Button>
        </div>
      </div>
    </div>
  );
}
