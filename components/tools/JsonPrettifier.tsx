"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function formatJson(input: string, indent: number) {
  try {
    const parsed = JSON.parse(input);
    return {
      output: JSON.stringify(parsed, null, indent),
      error: null as string | null,
    };
  } catch (error) {
    return {
      output: "",
      error: (error as Error).message,
    };
  }
}

export default function JsonPrettifier() {
  const [raw, setRaw] = useState("{\n  \"hello\": \"world\"\n}");
  const [indent, setIndent] = useState(2);
  const [result, setResult] = useState(() => formatJson("{\n  \"hello\": \"world\"\n}", 2));

  const handleFormat = () => {
    setResult(formatJson(raw, indent));
  };

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]"
        onSubmit={(event) => {
          event.preventDefault();
          handleFormat();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="json-input">JSON input</Label>
          <Textarea
            id="json-input"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            spellCheck={false}
            className="min-h-[240px] font-mono text-sm"
          />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="indent">Indent spaces</Label>
            <Input
              id="indent"
              type="number"
              min={0}
              max={8}
              value={indent}
              onChange={(event) => setIndent(Number(event.target.value) || 0)}
            />
          </div>
          <Button type="submit" className="w-full">
            Format JSON
          </Button>
          {result.error ? (
            <p className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
              {result.error}
            </p>
          ) : (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              Valid JSON detected.
            </p>
          )}
        </div>
      </form>
      <div className="space-y-2">
        <Label htmlFor="json-output">Formatted output</Label>
        <Textarea
          id="json-output"
          readOnly
          value={result.output}
          spellCheck={false}
          className="min-h-[240px] font-mono text-sm"
        />
      </div>
    </div>
  );
}
