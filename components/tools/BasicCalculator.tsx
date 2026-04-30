"use client";

import { useEffect, useRef, useState } from "react";
import { Delete, Clock, Tag, Percent, Scale, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import WeightPriceCalculator from "./WeightPriceCalculator";

type CalcTab = "calculator" | "weight";

const STORAGE_KEY = "calc-history";
const MAX_HISTORY = 50;
const ALLOWED_RE = /^[0-9+\-*/().%\s]*$/;

type HistoryItem = { expression: string; result: string; timestamp: number };

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

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < input.length && (input[pos] === "+" || input[pos] === "-")) {
      const op = input[pos++];
      left = op === "+" ? left + parseTerm() : left - parseTerm();
    }
    return left;
  }

  const result = parseExpr();
  if (pos !== input.length) throw new Error("Unexpected character: " + input[pos]);
  if (!isFinite(result)) throw new Error("Result is undefined (e.g. division by zero)");
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

export default function BasicCalculator() {
  const [activeTab, setActiveTab] = useState<CalcTab>("calculator");
  const [expression, setExpression] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeQuickAction, setActiveQuickAction] = useState<"gst" | "discount" | null>(null);
  const [lastFlash, setLastFlash] = useState<"gst" | "discount" | null>(null);
  const [quickPct, setQuickPct] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const quickPctRef = useRef<HTMLInputElement>(null);

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

  const appendToExpression = (char: string) => {
    setExpression((prev) => prev + char);
    setError(null);
    inputRef.current?.focus();
  };

  const handleEvaluate = () => {
    try {
      const result = safeEval(expression);
      const item: HistoryItem = {
        expression: expression.trim(),
        result,
        timestamp: Date.now(),
      };
      setHistory((prev) => [item, ...prev].slice(0, MAX_HISTORY));
      setExpression(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid expression");
    }
  };

  const handleClear = () => {
    setExpression("");
    setError(null);
    inputRef.current?.focus();
  };

  const handleBackspace = () => {
    setExpression((prev) => prev.slice(0, -1));
    setError(null);
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (ALLOWED_RE.test(val)) {
      setExpression(val);
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEvaluate();
    }
  };

  const clearHistory = () => setHistory([]);

  const loadHistoryItem = (item: HistoryItem) => {
    setExpression(item.expression);
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

  /** Precise percentage: avoids IEEE-754 drift for common financial numbers. */
  const pct = (value: number, rate: number): number =>
    Math.round(value * rate * 1e10) / 1e12;

  const triggerFlash = (type: "gst" | "discount") => {
    setLastFlash(type);
    setTimeout(() => setLastFlash(null), 700);
  };

  const applyGst = (rate: number) => {
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
    setError(null);
    setActiveQuickAction(null);
    setQuickPct("");
    triggerFlash("gst");
    inputRef.current?.focus();
  };

  const applyDiscount = (rate: number) => {
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
    setError(null);
    setActiveQuickAction(null);
    setQuickPct("");
    triggerFlash("discount");
    inputRef.current?.focus();
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
              "w-full rounded-xl border px-4 py-3 text-right font-mono text-2xl",
              "bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring",
              error ? "border-destructive" : "border-border/60"
            )}
          />
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
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : activeQuickAction === "gst"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
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
                  className="w-full rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-1.5 text-sm font-mono text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200"
                />
                <span className="text-sm text-emerald-700 dark:text-emerald-300">%</span>
                <button
                  type="button"
                  onClick={() => { const r = parseFloat(quickPct); if (isFinite(r) && r > 0) applyGst(r); }}
                  disabled={!quickPct || parseFloat(quickPct) <= 0}
                  className="rounded-lg border border-emerald-500/50 bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
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
                  ? "border-rose-500 bg-rose-500/20 text-rose-700 dark:text-rose-300"
                  : activeQuickAction === "discount"
                    ? "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300"
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
                  className="w-full rounded-lg border border-rose-500/40 bg-rose-50 px-3 py-1.5 text-sm font-mono text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-rose-950/40 dark:text-rose-200"
                />
                <span className="text-sm text-rose-700 dark:text-rose-300">%</span>
                <button
                  type="button"
                  onClick={() => { const r = parseFloat(quickPct); if (isFinite(r) && r > 0) applyDiscount(r); }}
                  disabled={!quickPct || parseFloat(quickPct) <= 0}
                  className="rounded-lg border border-rose-500/50 bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-600 disabled:opacity-40"
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
                  {new Date(item.timestamp).toLocaleTimeString()}
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
