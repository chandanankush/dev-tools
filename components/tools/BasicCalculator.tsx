"use client";

import { useEffect, useRef, useState } from "react";
import { Delete, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "calc-history";
const MAX_HISTORY = 50;
const ALLOWED_RE = /^[0-9+\-*/().\s]*$/;

type HistoryItem = { expression: string; result: string; timestamp: number };

function safeEval(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) throw new Error("Expression is empty");
  if (!ALLOWED_RE.test(trimmed)) throw new Error("Invalid characters in expression");
  // eslint-disable-next-line no-new-func
  const result: unknown = new Function(`"use strict"; return (${trimmed})`)();
  if (typeof result !== "number") throw new Error("Expression did not evaluate to a number");
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
  { label: "0",  value: "0",  type: "zero" },
  { label: ".",  value: ".",  type: "dot" },
  { label: "⌫",  type: "backspace" },
  { label: "=",  type: "equals" },
];

export default function BasicCalculator() {
  const [expression, setExpression] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Calculator panel */}
      <div className="flex-1 space-y-4">
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
              "bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring",
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
                  className={buttonClass("equals")}
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
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
