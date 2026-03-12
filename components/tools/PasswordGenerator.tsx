"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, RefreshCw, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CHAR_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?",
} as const;

type CharSet = keyof typeof CHAR_SETS;

const OPTION_LABELS: Record<CharSet, string> = {
  uppercase: "Uppercase  A–Z",
  lowercase: "Lowercase  a–z",
  numbers:   "Numbers  0–9",
  symbols:   "Symbols  !@#$…",
};

function strengthLabel(score: number): { label: string; color: string } {
  if (score <= 1) return { label: "Weak",   color: "bg-red-500"    };
  if (score === 2) return { label: "Fair",   color: "bg-amber-500"  };
  if (score === 3) return { label: "Good",   color: "bg-yellow-400" };
  return              { label: "Strong", color: "bg-emerald-500" };
}

function scorePassword(pwd: string, length: number, sets: Set<CharSet>): number {
  let score = 0;
  if (length >= 12) score++;
  if (length >= 20) score++;
  if (sets.has("uppercase") && sets.has("lowercase")) score++;
  if (sets.has("numbers")) score++;
  if (sets.has("symbols")) score++;
  return Math.min(score, 4);
}

function generatePassword(length: number, sets: Set<CharSet>): string {
  if (sets.size === 0) return "";
  const pool = Array.from(sets)
    .map((s) => CHAR_SETS[s])
    .join("");

  // Guarantee at least one char from each selected set
  const required = Array.from(sets).map((s) => {
    const chars = CHAR_SETS[s];
    return chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  });

  const remaining = Array.from({ length: length - required.length }, () => {
    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % pool.length;
    return pool[idx];
  });

  // Shuffle using Fisher-Yates with crypto random
  const all = [...required, ...remaining];
  for (let i = all.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join("");
}

export default function PasswordGenerator() {
  const [length, setLength]   = useState(16);
  const [sets, setSets]       = useState<Set<CharSet>>(new Set(["uppercase", "lowercase", "numbers", "symbols"]));
  const [password, setPassword] = useState("");
  const [copied, setCopied]   = useState(false);
  const [visible, setVisible] = useState(false);

  const regenerate = useCallback(() => {
    setPassword(generatePassword(length, sets));
    setCopied(false);
  }, [length, sets]);

  useEffect(() => { regenerate(); }, [regenerate]);

  const toggleSet = (key: CharSet) => {
    setSets((prev) => {
      if (prev.size === 1 && prev.has(key)) return prev; // keep at least one
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyPassword = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const score = scorePassword(password, length, sets);
  const { label: strengthText, color: strengthColor } = strengthLabel(score);

  return (
    <div className="space-y-8">

      {/* Password display */}
      <div className="space-y-2">
        <Label>Generated Password</Label>
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <span
            className={cn(
              "flex-1 break-all font-mono text-base select-all",
              !visible && "tracking-widest text-xl"
            )}
          >
            {password ? (visible ? password : "•".repeat(password.length)) : "—"}
          </span>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={copyPassword}
            disabled={!password}
            className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
            aria-label="Copy password"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        {/* Strength bar */}
        {password && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    n <= score ? strengthColor : "bg-border"
                  )}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{strengthText} password</p>
          </div>
        )}
      </div>

      {/* Length slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="pwd-length">Length</Label>
          <span className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-0.5 font-mono text-sm">
            {length}
          </span>
        </div>
        <input
          id="pwd-length"
          type="range"
          min={4}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label="Password length"
        />
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>4</span>
          <span>64</span>
        </div>
      </div>

      {/* Character set checkboxes */}
      <div className="space-y-3">
        <Label>Include characters</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(CHAR_SETS) as CharSet[]).map((key) => {
            const checked = sets.has(key);
            const disabled = checked && sets.size === 1;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSet(key)}
                disabled={disabled}
                aria-pressed={checked}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked ? "border-primary bg-primary" : "border-muted-foreground"
                  )}
                >
                  {checked && (
                    <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-primary-foreground" aria-hidden>
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-sm">{OPTION_LABELS[key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Regenerate */}
      <Button type="button" onClick={regenerate} className="w-full gap-2">
        <RefreshCw className="h-4 w-4" />
        Generate Password
      </Button>
    </div>
  );
}
