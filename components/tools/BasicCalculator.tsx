/**
 * BasicCalculator — two-tab wrapper that houses the arithmetic calculator
 * and the WeightPriceCalculator sub-tool.
 *
 * Expression evaluation uses a hand-written recursive descent parser
 * (parseNumber → parseFactor → parseTerm → parseExpr) instead of
 * eval() / new Function() because both are banned by the project's
 * Content-Security-Policy (no 'unsafe-eval'). See CLAUDE.md § CSP rule.
 *
 * The % operator is resolved in two preprocessing passes before the
 * parser even sees the string:
 *   Pass 1 (context-aware)  — "200+10%" → "200+(200*(10/100))" so that
 *     percentage-of-base semantics match most calculator conventions.
 *   Pass 2 (standalone/multiplicative) — any remaining "n%" → "(n/100)"
 *     covering cases like "50%" → 0.5 or "200*10%" → 20.
 *
 * History is kept in localStorage under STORAGE_KEY, capped at
 * MAX_HISTORY entries (FIFO) so the serialised JSON never grows large
 * enough to hit quota limits.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Clock, Tag, Percent, Scale, Calculator, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import WeightPriceCalculator from "./WeightPriceCalculator";
import { useCopyFlag } from "@/lib/hooks/useCopyFlag";
import { copyToClipboard } from "@/lib/clipboard";

type CalcTab = "calculator" | "weight";

const STORAGE_KEY = "calc-history";
/** Cap prevents localStorage from growing unboundedly across long sessions. */
const MAX_HISTORY = 50;
const ALLOWED_RE = /^[0-9+\-*/().%\s]*$/;

type HistoryItem = { expression: string; result: string; timestamp: number };

/**
 * Formats a history entry timestamp relative to now so it stays meaningful
 * across days without consuming much space in the history panel.
 *   Same calendar day  → "10:30 AM"
 *   Previous day       → "Yesterday 10:30 AM"
 *   Older              → "Nov 15 10:30 AM"
 */
function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return timeStr;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
}

/**
 * Evaluates an arithmetic string without eval/new Function (CSP-safe).
 * Returns the result as a string, or throws a human-readable Error.
 */
function safeEval(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) throw new Error("Expression is empty");
  if (!ALLOWED_RE.test(trimmed)) throw new Error("Invalid characters in expression");

  // Recursive descent parser — no eval/new Function (CSP-safe)
  let pos = 0;
  // Preprocess % — two passes:
  // 1. Context-aware: a+b% → a+(a*(b/100)),  a-b% → a-(a*(b/100))  (e.g. 200+10% = 220)
  // 2. Standalone / multiplicative: number% → (number/100)          (e.g. 50% = 0.5, 200*10% = 20)
  const input = trimmed
    .replace(/\s+/g, "")
    .replace(/(\d+(?:\.\d*)?)([+-])(\d+(?:\.\d*)?)%/g, (_, a, op, b) => `${a}${op}(${a}*(${b}/100))`)
    .replace(/(\d+(?:\.\d*)?)%/g, "($1/100)");

  /**
   * Consumes a decimal literal at the current position.
   * The parser uses a shared mutable `pos` cursor — all four parse*
   * functions advance it as they consume characters.
   */
  function parseNumber(): number {
    const start = pos;
    while (pos < input.length && /[0-9]/.test(input[pos])) pos++;
    if (pos < input.length && input[pos] === ".") {
      pos++;
      while (pos < input.length && /[0-9]/.test(input[pos])) pos++;
    }
    if (pos === start) throw new Error("Unexpected token at position " + pos);
    return parseFloat(input.slice(start, pos));
  }

  /**
   * Handles unary sign and parenthesised sub-expressions — the highest
   * precedence level in the grammar (factor = atom or unary-prefixed atom).
   */
  function parseFactor(): number {
    if (pos < input.length && input[pos] === "-") { pos++; return -parseFactor(); }
    if (pos < input.length && input[pos] === "+") { pos++; return parseFactor(); }
    if (pos < input.length && input[pos] === "(") {
      pos++;
      const val = parseExpr();
      if (pos >= input.length || input[pos] !== ")") throw new Error("Mismatched parentheses");
      pos++;
      return val;
    }
    return parseNumber();
  }

  /** Handles * and / — left-associative, higher precedence than + and -. */
  function parseTerm(): number {
    let left = parseFactor();
    while (pos < input.length && (input[pos] === "*" || input[pos] === "/")) {
      const op = input[pos++];
      const right = parseFactor();
      if (op === "/") {
        if (right === 0) throw new Error("Result is undefined (e.g. division by zero)");
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  /** Handles + and - — the lowest precedence binary operators. */
  function parseExpr(): number {
    let left = parseTerm();
    while (pos < input.length && (input[pos] === "+" || input[pos] === "-")) {
      const op = input[pos++];
      left = op === "+" ? left + parseTerm() : left - parseTerm();
    }
    return left;
  }

  const result = parseExpr();
  // Any unconsumed characters indicate a syntax error (e.g. trailing ")").
  if (pos !== input.length) throw new Error("Unexpected character: " + input[pos]);
  if (!isFinite(result)) throw new Error("Result is undefined (e.g. division by zero)");
  // toPrecision(12) trims insignificant trailing digits from IEEE-754 results
  // (e.g. 0.1 + 0.2 → "0.3" instead of "0.30000000000000004").
  return Number(result.toPrecision(12)).toString();
}

type CalcButton =
  | { label: string; value: string; type: "digit" | "operator" | "paren" | "dot" }
  | { label: string; type: "clear" | "backspace" | "equals" }
  | { label: string; value: string; type: "zero" };

const BUTTONS: CalcButton[] = [
  { label: "C",  type: "clear" },
  { label: "(",  value: "(",  type: "paren" },
  { label: ")",  value: ")",  type: "paren" },
  { label: "÷",  value: "/",  type: "operator" },
  { label: "7",  value: "7",  type: "digit" },
  { label: "8",  value: "8",  type: "digit" },
  { label: "9",  value: "9",  type: "digit" },
  { label: "×",  value: "*",  type: "operator" },
  { label: "4",  value: "4",  type: "digit" },
  { label: "5",  value: "5",  type: "digit" },
  { label: "6",  value: "6",  type: "digit" },
  { label: "−",  value: "-",  type: "operator" },
  { label: "1",  value: "1",  type: "digit" },
  { label: "2",  value: "2",  type: "digit" },
  { label: "3",  value: "3",  type: "digit" },
  { label: "+",  value: "+",  type: "operator" },
  { label: "0",  value: "0",  type: "digit" },
  { label: "%",  value: "%",  type: "operator" },
  { label: ".",  value: ".",  type: "dot" },
  { label: "⌫",  type: "backspace" },
  { label: "=",  type: "equals" },
];

/** Root component — mounts the tab bar and delegates to the active sub-panel. */
export default function BasicCalculator() {
  const [activeTab, setActiveTab] = useState<CalcTab>("calculator");
  const [expression, setExpression] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeQuickAction, setActiveQuickAction] = useState<"gst" | "discount" | null>(null);
  const [lastFlash, setLastFlash] = useState<"gst" | "discount" | null>(null);
  const [quickPct, setQuickPct] = useState("");
  // Tracks whether the last action was an evaluation — used by appendToExpression
  // to decide whether a digit starts a fresh expression or continues the current one.
  const [justEvaled, setJustEvaled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const quickPctRef = useRef<HTMLInputElement>(null);
  // Mirrors of mutable state used inside the global keyboard useEffect so it
  // never has to be re-registered on every keystroke (stale closure prevention).
  const expressionRef = useRef(expression);
  const justEvaledRef = useRef(justEvaled);
  expressionRef.current = expression;
  justEvaledRef.current = justEvaled;

  const { isCopied: resultCopied, trigger: triggerResultCopy } = useCopyFlag();

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored) as HistoryItem[]);
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore storage errors
    }
  }, [history]);

  // Stable callbacks — read live values from refs instead of closing over state
  // so they can be added to the global keyboard useEffect deps array without
  // causing it to re-register on every keystroke.

  const appendToExpression = useCallback((char: string) => {
    const wasEvaled = justEvaledRef.current;
    if (wasEvaled) {
      // After =: a digit/dot starts a new expression; an operator chains onto
      // the result (e.g. pressing + after "= 8" gives "8+", not a blank "+" ).
      setExpression(/[0-9.]/.test(char) ? char : expressionRef.current + char);
      setJustEvaled(false);
    } else {
      setExpression((prev) => prev + char);
    }
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleEvaluate = useCallback(() => {
    const expr = expressionRef.current;
    try {
      const result = safeEval(expr);
      const item: HistoryItem = {
        expression: expr.trim(),
        result,
        timestamp: Date.now(),
      };
      // Prepend newest entry and keep only the last MAX_HISTORY items.
      setHistory((prev) => [item, ...prev].slice(0, MAX_HISTORY));
      setExpression(result);
      setJustEvaled(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid expression");
    }
  }, []);

  const handleClear = useCallback(() => {
    setExpression("");
    setJustEvaled(false);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleBackspace = useCallback(() => {
    setExpression((prev) => prev.slice(0, -1));
    setJustEvaled(false);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (ALLOWED_RE.test(val)) {
      setExpression(val);
      setJustEvaled(false);
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEvaluate();
    }
    // Escape clears the expression when the input has focus.
    if (e.key === "Escape") {
      e.preventDefault();
      handleClear();
    }
  };

  // Global keyboard handler — lets users type calculations without first
  // clicking into the expression field. Skips when focus is inside any
  // input or textarea (those elements handle their own keys natively).
  // Re-registers only when the active tab changes; stale state is read
  // through expressionRef / justEvaledRef.
  useEffect(() => {
    if (activeTab !== "calculator") return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (/^[0-9.]$/.test(e.key) || "+-*/()%".includes(e.key)) {
        e.preventDefault();
        appendToExpression(e.key);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleEvaluate();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClear();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, appendToExpression, handleEvaluate, handleClear, handleBackspace]);

  const clearHistory = () => setHistory([]);

  const loadHistoryItem = (item: HistoryItem) => {
    setExpression(item.expression);
    setJustEvaled(false);
    setError(null);
    inputRef.current?.focus();
  };

  /** Returns the numeric value of the current expression, or null if invalid/empty. */
  const getCurrentValue = (): number | null => {
    if (!expression.trim()) return null;
    try {
      const val = parseFloat(safeEval(expression));
      return isFinite(val) ? val : null;
    } catch {
      return null;
    }
  };

  /**
   * Returns `value * rate / 100` trimmed to 12 significant figures to avoid
   * IEEE-754 drift (e.g. 100 * 0.18 → 18, not 18.000000000000004).
   * Uses toPrecision(12) rather than the 1e10/1e12 multiply trick, which
   * overflows Number.MAX_SAFE_INTEGER for large input values.
   */
  const pct = (value: number, rate: number): number =>
    parseFloat((value * rate / 100).toPrecision(12));

  const triggerFlash = (type: "gst" | "discount") => {
    setLastFlash(type);
    setTimeout(() => setLastFlash(null), 700);
  };

  const applyGst = (rate: number) => {
    if (rate > 100) { setError("GST rate cannot exceed 100%"); return; }
    const val = getCurrentValue();
    if (val === null) { setError("Enter an amount first"); return; }
    const tax = pct(val, rate);
    const result = parseFloat((val + tax).toFixed(10));
    const resultStr = Number(result.toPrecision(12)).toString();
    const item: HistoryItem = {
      expression: `${val} + ${tax} GST @${rate}%`,
      result: resultStr,
      timestamp: Date.now(),
    };
    setHistory((prev) => [item, ...prev].slice(0, MAX_HISTORY));
    setExpression(resultStr);
    setJustEvaled(true);
    setError(null);
    setActiveQuickAction(null);
    setQuickPct("");
    triggerFlash("gst");
    inputRef.current?.focus();
  };

  const applyDiscount = (rate: number) => {
    if (rate > 100) { setError("Discount cannot exceed 100%"); return; }
    const val = getCurrentValue();
    if (val === null) { setError("Enter an amount first"); return; }
    const discount = pct(val, rate);
    const result = parseFloat((val - discount).toFixed(10));
    const resultStr = Number(result.toPrecision(12)).toString();
    const item: HistoryItem = {
      expression: `${val} − ${discount} off @${rate}%`,
      result: resultStr,
      timestamp: Date.now(),
    };
    setHistory((prev) => [item, ...prev].slice(0, MAX_HISTORY));
    setExpression(resultStr);
    setJustEvaled(true);
    setError(null);
    setActiveQuickAction(null);
    setQuickPct("");
    triggerFlash("discount");
    inputRef.current?.focus();
  };

  const handleCopyResult = async () => {
    if (!expression) return;
    try {
      await copyToClipboard(expression);
      triggerResultCopy();
    } catch {
      // Clipboard unavailable — silently ignore
    }
  };

  const buttonClass = (type: CalcButton["type"]) =>
    cn(
      "flex items-center justify-center rounded-xl border font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "active:scale-95 transition-transform",
      "h-14 text-lg select-none",
      type === "equals"
        ? "col-span-1 bg-primary text-primary-foreground border-primary hover:bg-primary/90"
        : type === "clear"
          ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
          : type === "backspace"
            ? "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted"
            : type === "operator"
              ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              : "border-border/60 bg-card text-card-foreground hover:bg-muted/60"
    );

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("calculator")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
            activeTab === "calculator"
              ? "bg-background shadow text-foreground"
              : "text-foreground/60 hover:text-foreground hover:bg-background/50"
          )}
        >
          <Calculator className="h-4 w-4" />
          Calculator
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("weight")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
            activeTab === "weight"
              ? "bg-background shadow text-foreground"
              : "text-foreground/60 hover:text-foreground hover:bg-background/50"
          )}
        >
          <Scale className="h-4 w-4" />
          Weight Price
        </button>
      </div>

      {activeTab === "weight" ? (
        <WeightPriceCalculator />
      ) : (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      {/* Calculator panel */}
      <div className="w-full max-w-xs space-y-4">
        {/* Expression input */}
        <div className="space-y-1">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              aria-label="Expression"
              value={expression}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="0"
              spellCheck={false}
              autoComplete="off"
              className={cn(
                "w-full rounded-xl border px-4 py-3 pr-10 text-right font-mono text-2xl",
                "bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring",
                error ? "border-destructive" : "border-border/60"
              )}
            />
            {/* Copy button — fades in when expression is non-empty */}
            <button
              type="button"
              aria-label="Copy result"
              disabled={!expression}
              onClick={() => void handleCopyResult()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-0 transition-opacity"
            >
              {resultCopied
                ? <Check className="h-4 w-4 text-success" />
                : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {error && (
            <p className="text-right text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Button grid */}
        <div className="grid grid-cols-4 gap-2">
          {BUTTONS.map((btn, i) => {
            if (btn.type === "zero") {
              return (
                <button
                  key={i}
                  type="button"
                  aria-label="0"
                  className={cn(buttonClass("digit"), "col-span-2")}
                  onClick={() => appendToExpression("0")}
                >
                  {btn.label}
                </button>
              );
            }
            if (btn.type === "clear") {
              return (
                <button
                  key={i}
                  type="button"
                  aria-label="Clear"
                  className={buttonClass("clear")}
                  onClick={handleClear}
                >
                  {btn.label}
                </button>
              );
            }
            if (btn.type === "backspace") {
              return (
                <button
                  key={i}
                  type="button"
                  aria-label="Backspace"
                  className={buttonClass("backspace")}
                  onClick={handleBackspace}
                >
                  <Delete className="h-5 w-5" />
                </button>
              );
            }
            if (btn.type === "equals") {
              return (
                <button
                  key={i}
                  type="button"
                  aria-label="Equals"
                  className={cn(buttonClass("equals"), "col-span-4")}
                  onClick={handleEvaluate}
                >
                  {btn.label}
                </button>
              );
            }
            // digit, operator, paren, dot
            const { value, label } = btn as { value: string; label: string; type: string };
            return (
              <button
                key={i}
                type="button"
                aria-label={label}
                className={buttonClass(btn.type)}
                onClick={() => appendToExpression(value)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/60">
            Quick Actions
          </p>

          {/* GST */}
          <div className="space-y-1.5">
            <button
              type="button"
              aria-label="Add GST"
              disabled={getCurrentValue() === null}
              onClick={() => setActiveQuickAction((a) => (a === "gst" ? null : "gst"))}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-40",
                lastFlash === "gst"
                  ? "border-success bg-success/20 text-success"
                  : activeQuickAction === "gst"
                    ? "border-success/60 bg-success/10 text-success"
                    : "border-border/60 bg-card text-card-foreground hover:bg-muted/60"
              )}
            >
              <Tag className="h-3.5 w-3.5" />
              + GST
            </button>
            {activeQuickAction === "gst" && (
              <div className="flex items-center gap-2">
                <input
                  ref={quickPctRef}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  aria-label="GST percentage"
                  placeholder="e.g. 18"
                  value={quickPct}
                  onChange={(e) => setQuickPct(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const r = parseFloat(quickPct);
                      if (isFinite(r) && r > 0) applyGst(r);
                    }
                    if (e.key === "Escape") { setActiveQuickAction(null); setQuickPct(""); }
                  }}
                  autoFocus
                  className="w-full rounded-lg border border-success/40 bg-success/5 px-3 py-1.5 text-sm font-mono text-success focus:outline-none focus:ring-2 focus:ring-success"
                />
                <span className="text-sm text-success">%</span>
                <button
                  type="button"
                  onClick={() => { const r = parseFloat(quickPct); if (isFinite(r) && r > 0) applyGst(r); }}
                  disabled={!quickPct || parseFloat(quickPct) <= 0}
                  className="rounded-lg border border-success/50 bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground transition-colors hover:bg-success/90 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Discount */}
          <div className="space-y-1.5">
            <button
              type="button"
              aria-label="Apply Discount"
              disabled={getCurrentValue() === null}
              onClick={() => setActiveQuickAction((a) => (a === "discount" ? null : "discount"))}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-40",
                lastFlash === "discount"
                  ? "border-destructive bg-destructive/20 text-destructive"
                  : activeQuickAction === "discount"
                    ? "border-destructive/60 bg-destructive/10 text-destructive"
                    : "border-border/60 bg-card text-card-foreground hover:bg-muted/60"
              )}
            >
              <Percent className="h-3.5 w-3.5" />
              − Discount
            </button>
            {activeQuickAction === "discount" && (
              <div className="flex items-center gap-2">
                <input
                  ref={quickPctRef}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  aria-label="Discount percentage"
                  placeholder="e.g. 20"
                  value={quickPct}
                  onChange={(e) => setQuickPct(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const r = parseFloat(quickPct);
                      if (isFinite(r) && r > 0) applyDiscount(r);
                    }
                    if (e.key === "Escape") { setActiveQuickAction(null); setQuickPct(""); }
                  }}
                  autoFocus
                  className="w-full rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm font-mono text-destructive focus:outline-none focus:ring-2 focus:ring-destructive"
                />
                <span className="text-sm text-destructive">%</span>
                <button
                  type="button"
                  onClick={() => { const r = parseFloat(quickPct); if (isFinite(r) && r > 0) applyDiscount(r); }}
                  disabled={!quickPct || parseFloat(quickPct) <= 0}
                  className="rounded-lg border border-destructive/50 bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History panel */}
      <div className="w-full shrink-0 space-y-3 lg:w-64">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" />
            History
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Clear
            </button>
          )}
        </div>

        <div
          className={cn(
            "max-h-96 overflow-y-auto rounded-xl border border-border/60",
            "divide-y divide-border/40"
          )}
        >
          {history.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No calculations yet
            </p>
          ) : (
            history.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => loadHistoryItem(item)}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-muted/40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                )}
              >
                <p className="truncate font-mono text-sm text-muted-foreground">
                  {item.expression}
                </p>
                <p className="font-mono text-base font-semibold text-foreground">
                  = {item.result}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatTimestamp(item.timestamp)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
      )}
    </div>
  );
}
