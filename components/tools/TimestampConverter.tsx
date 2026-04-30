"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Unit = "seconds" | "milliseconds";
type TZ = "local" | "utc";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  return { copied, copy };
}

function nowInUnit(unit: Unit): string {
  const ms = Date.now();
  return unit === "seconds" ? Math.floor(ms / 1000).toString() : ms.toString();
}

function formatDate(date: Date, tz: TZ): string {
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz === "utc" ? "UTC" : undefined,
  };
  return new Intl.DateTimeFormat("en-CA", opts).format(date).replace(", ", "T");
}

function parseTimestamp(raw: string, unit: Unit): Date | null {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return null;
  const ms = unit === "seconds" ? n * 1000 : n;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function parseDateInput(raw: string): Date | null {
  if (!raw.trim()) return null;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d;
}

export default function TimestampConverter() {
  const [unit, setUnit] = useState<Unit>("seconds");
  const [tz, setTz] = useState<TZ>("local");

  // Timestamp → Date
  const [tsInput, setTsInput] = useState(() => nowInUnit("seconds"));
  const tsDate = parseTimestamp(tsInput, unit);
  const tsResult = tsDate ? formatDate(tsDate, tz) : null;
  const tsError = tsInput && !tsDate ? "Invalid timestamp" : null;
  const tsCopy = useCopy();

  // Date → Timestamp
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date();
    d.setMilliseconds(0);
    return d.toISOString().slice(0, 19);
  });
  const dtDate = parseDateInput(dateInput);
  const dtResult = dtDate
    ? unit === "seconds"
      ? Math.floor(dtDate.getTime() / 1000).toString()
      : dtDate.getTime().toString()
    : null;
  const dtError = dateInput && !dtDate ? "Invalid date" : null;
  const dtCopy = useCopy();

  // Live "now" ticker
  const [nowTs, setNowTs] = useState(() => nowInUnit("seconds"));
  useEffect(() => {
    const id = setInterval(() => setNowTs(nowInUnit(unit)), 1000);
    return () => clearInterval(id);
  }, [unit]);

  const setToNow = () => setTsInput(nowInUnit(unit));

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-6">
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-muted-foreground">Unit</legend>
          <div className="flex gap-1">
            {(["seconds", "milliseconds"] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={cn(
                  "rounded-md border px-3 py-1 font-mono text-xs transition-colors",
                  u === unit
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {u === "seconds" ? "s" : "ms"}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-muted-foreground">Timezone</legend>
          <div className="flex gap-1">
            {(["local", "utc"] as TZ[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTz(t)}
                className={cn(
                  "rounded-md border px-3 py-1 font-mono text-xs transition-colors",
                  t === tz
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="ml-auto rounded-md border border-border/80 bg-muted/50 px-3 py-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">now = </span>
          <span className="font-mono text-xs text-foreground">{nowTs}</span>
        </div>
      </div>

      {/* Timestamp → Date */}
      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Timestamp → Date
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="ts-input">Unix timestamp ({unit})</Label>
            <Input
              id="ts-input"
              value={tsInput}
              onChange={(e) => setTsInput(e.target.value)}
              placeholder={unit === "seconds" ? "e.g. 1700000000" : "e.g. 1700000000000"}
              className={cn("font-mono", tsError && "border-destructive focus-visible:ring-destructive")}
              spellCheck={false}
            />
            {tsError && <p className="text-xs text-destructive">{tsError}</p>}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={setToNow} title="Use current time">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {tsResult && (
          <div className="space-y-2">
            <Label>Result</Label>
            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/50 px-4 py-3">
              <span className="flex-1 font-mono text-sm text-foreground">{tsResult}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{tz.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => tsCopy.copy(tsResult)}
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label="Copy result"
              >
                {tsCopy.copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {tsDate && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 font-mono text-[11px] text-muted-foreground">
                <span>
                  ISO 8601:{" "}
                  <span className="text-foreground">{tsDate.toISOString()}</span>
                </span>
                <span>
                  Day of week:{" "}
                  <span className="text-foreground">
                    {tsDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      timeZone: tz === "utc" ? "UTC" : undefined,
                    })}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Date → Timestamp */}
      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Date → Timestamp
        </p>
        <div className="space-y-2">
          <Label htmlFor="date-input">Date / datetime string</Label>
          <Input
            id="date-input"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            placeholder="e.g. 2024-11-15T08:30:00 or 2024-11-15"
            className={cn("font-mono", dtError && "border-destructive focus-visible:ring-destructive")}
            spellCheck={false}
          />
          {dtError && <p className="text-xs text-destructive">{dtError}</p>}
        </div>

        {dtResult && (
          <div className="space-y-2">
            <Label>Result</Label>
            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/50 px-4 py-3">
              <span className="flex-1 font-mono text-sm text-foreground">{dtResult}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{unit}</span>
              <button
                type="button"
                onClick={() => dtCopy.copy(dtResult)}
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label="Copy result"
              >
                {dtCopy.copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
