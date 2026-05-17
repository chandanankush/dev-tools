/**
 * PasswordGenerator — generates cryptographically random passwords with
 * configurable length and character sets.
 *
 * Security decisions:
 * - `unbiasedRandom(n)` uses rejection sampling instead of `% n` on a
 *   `crypto.getRandomValues()` result to eliminate modulo bias. See CLAUDE.md
 *   rule 1 for the full explanation and the banned `% n` pattern.
 * - Fisher-Yates shuffle using `unbiasedRandom` ensures the required characters
 *   (one from each selected set) are placed at uniformly random positions rather
 *   than always at the start.
 * - `navigator.clipboard.writeText` is called directly in `copyPassword` (not
 *   via `copyToClipboard`) because the password display doesn't need an error
 *   surface — the copy button just silently fails if the API is unavailable.
 *
 * UX decisions:
 * - At least one character from each selected set is guaranteed (`required` array
 *   before the shuffle), so "uppercase + numbers" always produces a password with
 *   both, even at short lengths.
 * - The user cannot deselect all sets: `toggleSet` returns the unchanged set
 *   when it would become empty, keeping the generator always functional.
 * - `regenerate` is a `useCallback` with `[length, sets, customSymbols]` deps
 *   so the `useEffect` that calls it re-runs exactly when those inputs change.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, RefreshCw, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCopyFlag } from "@/lib/hooks/useCopyFlag";

const DEFAULT_SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?";

const CHAR_SETS_BASE = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
} as const;

type CharSet = keyof typeof CHAR_SETS_BASE | "symbols";

const OPTION_LABELS: Record<CharSet, string> = {
  uppercase: "Uppercase  A–Z",
  lowercase: "Lowercase  a–z",
  numbers:   "Numbers  0–9",
  symbols:   "Symbols",
};

function strengthLabel(score: number): { label: string; color: string } {
  if (score <= 1) return { label: "Weak",   color: "bg-destructive" };
  if (score === 2) return { label: "Fair",   color: "bg-warning"     };
  if (score === 3) return { label: "Good",   color: "bg-warning"     };
  return              { label: "Strong", color: "bg-success"      };
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

// Rejection sampling eliminates modulo bias when 2^32 isn't divisible by n.
function unbiasedRandom(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  let v: number;
  do { v = crypto.getRandomValues(new Uint32Array(1))[0]; } while (v >= limit);
  return v % n;
}

function generatePassword(length: number, sets: Set<CharSet>, customSymbols: string): string {
  const resolvedSymbols = customSymbols.trim() || DEFAULT_SYMBOLS;
  const charMap: Record<CharSet, string> = {
    ...CHAR_SETS_BASE,
    symbols: resolvedSymbols,
  };

  const activeSets = Array.from(sets).filter((s) => charMap[s].length > 0);
  if (activeSets.length === 0) return "";

  const pool = activeSets.map((s) => charMap[s]).join("");

  // Guarantee at least one char from each selected set
  const required = activeSets.map((s) => {
    const chars = charMap[s];
    return chars[unbiasedRandom(chars.length)];
  });

  const remaining = Array.from({ length: Math.max(0, length - required.length) }, () =>
    pool[unbiasedRandom(pool.length)]
  );

  // Shuffle using Fisher-Yates with crypto random
  const all = [...required, ...remaining];
  for (let i = all.length - 1; i > 0; i--) {
    const j = unbiasedRandom(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join("");
}

export default function PasswordGenerator() {
  const [length, setLength]   = useState(16);
  const [sets, setSets]       = useState<Set<CharSet>>(new Set(["uppercase", "lowercase", "numbers", "symbols"]));
  const [customSymbols, setCustomSymbols] = useState(DEFAULT_SYMBOLS);
  const [password, setPassword] = useState("");
  const { isCopied: copied, trigger: triggerCopy, reset: resetCopy } = useCopyFlag();
  const [visible, setVisible] = useState(false);

  const regenerate = useCallback(() => {
    setPassword(generatePassword(length, sets, customSymbols));
    resetCopy();
  }, [length, sets, customSymbols, resetCopy]);

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
    triggerCopy();
  };

  const score = scorePassword(password, length, sets);
  const { label: strengthText, color: strengthColor } = strengthLabel(score);

  return (
    <div className="space-y-8">

      {/* Password display */}
      <div className="space-y-2">
        <Label>Generated Password</Label>
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/50 px-4 py-3">
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
            className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Copy password"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
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
          <span className="rounded-md border border-border/80 bg-muted/50 px-2.5 py-0.5 font-mono text-sm">
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
        <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>4</span>
          <span>64</span>
        </div>
      </div>

      {/* Character set checkboxes */}
      <div className="space-y-3">
        <Label>Include characters</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(CHAR_SETS_BASE) as CharSet[]).concat("symbols").map((key) => {
            const checked = sets.has(key as CharSet);
            const disabled = checked && sets.size === 1;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSet(key as CharSet)}
                disabled={disabled}
                aria-pressed={checked}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  checked
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/60 hover:bg-muted/40",
                  disabled && "cursor-not-allowed opacity-40"
                )}
              >
                {/* High-contrast checkbox indicator */}
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2",
                    checked
                      ? "border-primary bg-primary text-white"
                      : "border-foreground/50 bg-background"
                  )}
                >
                  {checked && (
                    <svg viewBox="0 0 12 10" className="h-3 w-3" aria-hidden fill="none">
                      <path d="M1.5 5l3 3.5 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className={cn("text-sm font-medium", checked ? "text-foreground" : "text-muted-foreground")}>
                  {OPTION_LABELS[key as CharSet]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom symbols input — shown when symbols is checked */}
        {sets.has("symbols") && (
          <div className="space-y-2">
            <Label htmlFor="custom-symbols">Custom symbol set</Label>
            <Input
              id="custom-symbols"
              value={customSymbols}
              onChange={(e) => setCustomSymbols(e.target.value)}
              placeholder={DEFAULT_SYMBOLS}
              className="font-mono text-sm"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Edit to restrict symbols to what your target site accepts. Leave blank to use the default set.
            </p>
          </div>
        )}
      </div>

      {/* Regenerate */}
      <Button type="button" onClick={regenerate} className="w-full gap-2">
        <RefreshCw className="h-4 w-4" />
        Generate Password
      </Button>
    </div>
  );
}
