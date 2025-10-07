"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function createUuidList(count: number) {
  return Array.from({ length: Math.min(count, 100) }, () => crypto.randomUUID());
}

export default function UuidGenerator() {
  const [amount, setAmount] = useState(5);
  const [uuids, setUuids] = useState<string[]>([]);

  const regenerate = useCallback(() => {
    setUuids(createUuidList(amount));
  }, [amount]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-2">
          <Label htmlFor="uuid-output">Generated UUIDs</Label>
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
