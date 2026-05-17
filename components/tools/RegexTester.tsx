/**
 * RegexTester — interactive regular-expression playground.
 *
 * Users type a pattern and test string; matches are highlighted in real time
 * and listed with their character ranges and any named capture groups.
 *
 * Design decisions:
 * - Flag state is a Set<Flag> so toggling is a simple add/delete; the set is
 *   spread into a string only when constructing the RegExp.
 * - buildRegex returns null for two distinct reasons — empty pattern (no
 *   input yet, not an error) and invalid syntax (user error) — so the caller
 *   can distinguish "nothing to do" from "show an error message" without a
 *   separate boolean.
 * - highlightText builds a React node array (string segments interleaved with
 *   <mark> elements) rather than injecting HTML, avoiding dangerouslySetInnerHTML
 *   and the XSS risk that comes with it.
 * - The match loop in highlightText is capped at 500 iterations to prevent a
 *   zero-width-match pattern (e.g. `a*`) from hanging the browser in an
 *   infinite loop — JavaScript's RegExp.exec advances lastIndex by 0 for
 *   zero-length matches, so without the cap the while loop never terminates.
 * - Named capture groups (ES2018 `(?<name>…)`) are extracted from m.groups and
 *   shown beneath each match card so users can verify group bindings at a glance.
 */

"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCopyFlag } from "@/lib/hooks/useCopyFlag";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Flag = "g" | "i" | "m" | "s";

const FLAG_OPTIONS: { flag: Flag; label: string; title: string }[] = [
  { flag: "g", label: "g", title: "Global — find all matches" },
  { flag: "i", label: "i", title: "Case insensitive" },
  { flag: "m", label: "m", title: "Multiline — ^ and $ match line boundaries" },
  { flag: "s", label: "s", title: "Dot all — . matches newlines too" },
];

interface Match {
  value: string;
  index: number;
  groups: Record<string, string> | null;
}

/**
 * Compiles a RegExp from the user's pattern string and current flag set.
 * Returns null when the pattern is empty (no input yet) or syntactically
 * invalid, so the caller never receives a thrown exception.
 */
function buildRegex(pattern: string, flags: Set<Flag>): RegExp | null {
  // Empty string → user hasn't typed yet; return null silently, not an error.
  if (!pattern) return null;
  try {
    return new RegExp(pattern, Array.from(flags).join(""));
  } catch {
    // Invalid syntax (e.g. unmatched parenthesis); caller will surface the message.
    return null;
  }
}

/**
 * Runs the regex against text and returns a flat array of match descriptors.
 * A fresh RegExp is created with the "g" flag forced on when global mode is
 * active, because exec() only advances lastIndex on flag-g instances.
 */
function getMatches(regex: RegExp | null, text: string, global: boolean): Match[] {
  if (!regex || !text) return [];
  if (global) {
    const results: Match[] = [];
    let m: RegExpExecArray | null;
    // Ensure "g" is present so exec() iterates rather than always matching from position 0.
    const safeRegex = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
    while ((m = safeRegex.exec(text)) !== null) {
      results.push({
        value: m[0],
        index: m.index,
        // Spread groups into a plain object; m.groups is otherwise undefined in non-named patterns.
        groups: m.groups ? { ...m.groups } : null,
      });
      if (!regex.flags.includes("g")) break;
    }
    return results;
  }
  const m = regex.exec(text);
  if (!m) return [];
  return [{ value: m[0], index: m.index, groups: m.groups ? { ...m.groups } : null }];
}

/**
 * Produces a React node array that intersperses plain text strings with
 * highlighted <mark> spans for every match position.
 *
 * Returning React nodes (instead of raw HTML) keeps the render safe: no
 * dangerouslySetInnerHTML, no XSS vector from user-supplied patterns.
 *
 * The 500-iteration cap guards against zero-width patterns such as `a*` or
 * `(?=x)` that match at every position without advancing lastIndex,
 * which would otherwise spin the while loop indefinitely and freeze the tab.
 */
function highlightText(text: string, regex: RegExp | null, global: boolean): React.ReactNode {
  if (!regex || !text) return text;
  // Build a dedicated regex for the highlight pass with the correct global flag state.
  const flags = global ? (regex.flags.includes("g") ? regex.flags : regex.flags + "g") : regex.flags.replace("g", "");
  const safeRegex = new RegExp(regex.source, flags);
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let iterations = 0;
  // Clone with "g" so exec() can walk forward through the string.
  const clone = new RegExp(safeRegex.source, safeRegex.flags.includes("g") ? safeRegex.flags : safeRegex.flags + "g");
  while ((m = clone.exec(text)) !== null && iterations < 500) {
    iterations++;
    // Emit any unmatched text before this match as a plain string node.
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <mark
        key={`${m.index}-${iterations}`}
        className="rounded-sm bg-primary/30 text-foreground"
      >
        {m[0]}
      </mark>
    );
    last = m.index + m[0].length;
    // Non-global mode: stop after the first match.
    if (!safeRegex.flags.includes("g")) break;
  }
  // Emit any trailing text after the last match.
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Interactive regex tester with live highlight preview and match list. */
export default function RegexTester() {
  const [pattern, setPattern] = useState("");
  // Default to "g" so first-time users immediately see all matches highlighted.
  const [flags, setFlags] = useState<Set<Flag>>(new Set(["g"]));
  const [testText, setTestText] = useState(
    "The quick brown fox jumps over the lazy dog.\nPack my box with five dozen liquor jugs."
  );
  const copyFlag = useCopyFlag();

  const regex = useMemo(() => buildRegex(pattern, flags), [pattern, flags]);
  const isGlobal = flags.has("g");
  const matches = useMemo(() => getMatches(regex, testText, isGlobal), [regex, testText, isGlobal]);
  const highlighted = useMemo(() => highlightText(testText, regex, isGlobal), [testText, regex, isGlobal]);

  // Separate memo for the error message so the input border can turn red
  // while regex/matches stay null (avoids double try/catch in buildRegex).
  const patternError = useMemo(() => {
    if (!pattern) return null;
    try {
      new RegExp(pattern, Array.from(flags).join(""));
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [pattern, flags]);

  /**
   * Produces a new Set with the flag added or removed.
   * Using functional setState guarantees the update is based on the latest
   * value even if multiple toggles fire quickly.
   */
  const toggleFlag = (flag: Flag) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) {
        next.delete(flag);
      } else {
        next.add(flag);
      }
      return next;
    });
  };

  const copyRegex = async () => {
    if (!pattern) return;
    // Copies in JS literal notation: /pattern/flags
    await navigator.clipboard.writeText(`/${pattern}/${Array.from(flags).join("")}`);
    copyFlag.trigger();
  };

  return (
    <div className="space-y-6">
      {/* Pattern row */}
      <div className="space-y-2">
        <Label htmlFor="regex-pattern">Regular Expression</Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground select-none">/</span>
            <Input
              id="regex-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. \b[A-Z]\w+"
              className={cn(
                "px-6 font-mono",
                patternError && "border-destructive focus-visible:ring-destructive"
              )}
              aria-describedby={patternError ? "regex-error" : undefined}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground select-none">
              /{Array.from(flags).join("")}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyRegex}
            disabled={!pattern}
            aria-label="Copy regex"
          >
            {copyFlag.isCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        {patternError && (
          <p id="regex-error" className="text-xs text-destructive">{patternError}</p>
        )}
      </div>

      {/* Flags */}
      <div className="space-y-2">
        <Label>Flags</Label>
        <div className="flex flex-wrap gap-2">
          {FLAG_OPTIONS.map(({ flag, label, title }) => (
            <button
              key={flag}
              type="button"
              title={title}
              onClick={() => toggleFlag(flag)}
              className={cn(
                "rounded-md border px-3 py-1 font-mono text-xs transition-colors",
                flags.has(flag)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Test text */}
      <div className="space-y-2">
        <Label htmlFor="test-text">Test String</Label>
        <Textarea
          id="test-text"
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Paste text to test against…"
          className="min-h-[120px] font-mono text-sm"
          spellCheck={false}
        />
      </div>

      {/* Highlighted preview */}
      {pattern && !patternError && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <div
            aria-label="Match preview"
            className="min-h-[80px] rounded-md border bg-muted/50 p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words"
          >
            {highlighted}
          </div>
        </div>
      )}

      {/* Match results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Matches</Label>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs text-primary">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </span>
        </div>

        {matches.length > 0 ? (
          <div className="space-y-2">
            {matches.map((m, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 bg-card px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono font-semibold text-primary">{JSON.stringify(m.value)}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    index {m.index}–{m.index + m.value.length}
                  </span>
                </div>
                {/* Named capture groups: only rendered when the pattern actually defined named groups. */}
                {m.groups && Object.keys(m.groups).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(m.groups).map(([k, v]) => (
                      <span key={k} className="font-mono text-xs text-muted-foreground">
                        <span className="text-primary">{k}</span>: {JSON.stringify(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          pattern && !patternError && (
            <p className="rounded-lg border border-dashed bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              No matches found.
            </p>
          )
        )}
      </div>
    </div>
  );
}
