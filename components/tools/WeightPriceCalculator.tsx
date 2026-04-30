"use client";

import { useState, useCallback } from "react";
import { RotateCcw, ArrowLeftRight, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Unit = "per_kg" | "per_500g" | "per_100g" | "per_2kg";
type RoundMode = "none" | "1" | "5" | "10";
type CalcMode = "normal" | "reverse";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<Unit, string> = {
  per_kg:   "per kg",
  per_500g: "per 500g",
  per_100g: "per 100g",
  per_2kg:  "per 2kg",
};

/** Convert any unit price to price-per-kg. */
function toPricePerKg(price: number, unit: Unit): number {
  switch (unit) {
    case "per_kg":   return price;
    case "per_500g": return price * 2;
    case "per_100g": return price * 10;
    case "per_2kg":  return price / 2;
  }
}

function roundTo(value: number, mode: RoundMode): number {
  if (mode === "none") return value;
  const step = parseInt(mode, 10);
  return Math.round(value / step) * step;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeightPriceCalculator() {
  const [price, setPrice]       = useState("");
  const [weight, setWeight]     = useState("");
  const [totalPrice, setTotalPrice] = useState(""); // reverse mode input
  const [unit, setUnit]         = useState<Unit>("per_kg");
  const [roundMode, setRoundMode] = useState<RoundMode>("none");
  const [mode, setMode]         = useState<CalcMode>("normal");

  // ─── Derived calculations ─────────────────────────────────────────────────

  const priceNum  = parseFloat(price);
  const weightNum = parseFloat(weight);
  const totalNum  = parseFloat(totalPrice);

  const isValidNormal  = isFinite(priceNum)  && priceNum  > 0 && isFinite(weightNum)  && weightNum  > 0;
  const isValidReverse = isFinite(priceNum)  && priceNum  > 0 && isFinite(totalNum)   && totalNum   > 0;

  const compute = useCallback((): {
    result: number;
    pricePerKg: number;
    breakdown: string;
    weightOut?: number;
  } | null => {
    if (mode === "normal") {
      if (!isValidNormal) return null;
      const ppkg    = toPricePerKg(priceNum, unit);
      const raw     = weightNum * ppkg;
      const result  = roundTo(raw, roundMode);
      return {
        result,
        pricePerKg: ppkg,
        breakdown: `${fmt(weightNum, 3)} kg × ₹${fmt(ppkg)}/kg`,
      };
    } else {
      if (!isValidReverse) return null;
      const ppkg      = toPricePerKg(priceNum, unit);
      const weightOut = totalNum / ppkg;
      return {
        result:     totalNum,
        pricePerKg: ppkg,
        breakdown:  `₹${fmt(totalNum)} ÷ ₹${fmt(ppkg)}/kg`,
        weightOut,
      };
    }
  }, [mode, isValidNormal, isValidReverse, priceNum, weightNum, totalNum, unit, roundMode]);

  const result = compute();

  // ─── Clear ────────────────────────────────────────────────────────────────

  const handleClear = () => {
    setPrice("");
    setWeight("");
    setTotalPrice("");
  };

  // ─── Input guard: no negatives ────────────────────────────────────────────

  const guardInput = (val: string, setter: (v: string) => void) => {
    if (val === "" || val === ".") { setter(val); return; }
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) setter(val);
  };

  // ─── UI ───────────────────────────────────────────────────────────────────

  const inputClass = cn(
    "w-full rounded-xl border bg-muted/50 px-4 py-4 text-right font-mono text-3xl",
    "focus:outline-none focus:ring-2 focus:ring-ring border-border/80",
    "placeholder:text-muted-foreground"
  );

  const chipClass = (active: boolean, color: "primary" | "rose" | "amber") =>
    cn(
      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
      active
        ? color === "primary"
          ? "border-primary bg-primary/10 text-primary"
          : color === "rose"
            ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-border/80 bg-card text-foreground/70 hover:bg-muted/60"
    );

  return (
    <div className="mx-auto w-full max-w-sm space-y-5">

      {/* Mode toggle */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted p-1.5">
        <button
          type="button"
          onClick={() => { setMode("normal"); handleClear(); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "normal" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Scale className="h-4 w-4" />
          Price → Total
        </button>
        <button
          type="button"
          onClick={() => { setMode("reverse"); handleClear(); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "reverse" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeftRight className="h-4 w-4" />
          Total → Weight
        </button>
      </div>

      {/* Price + unit selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Price <span className="text-xs">(₹)</span>
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          aria-label="Price"
          placeholder="0"
          value={price}
          onChange={(e) => guardInput(e.target.value, setPrice)}
          className={inputClass}
        />
        {/* Unit chips */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(UNIT_LABELS) as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={chipClass(unit === u, "primary")}
            >
              {UNIT_LABELS[u]}
            </button>
          ))}
        </div>
      </div>

      {/* Weight input (normal) or Total Price input (reverse) */}
      {mode === "normal" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Weight <span className="text-xs">(kg)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            aria-label="Weight"
            placeholder="0.000"
            value={weight}
            onChange={(e) => guardInput(e.target.value, setWeight)}
            className={inputClass}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Total Price <span className="text-xs">(₹)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            aria-label="Total Price"
            placeholder="0"
            value={totalPrice}
            onChange={(e) => guardInput(e.target.value, setTotalPrice)}
            className={inputClass}
          />
        </div>
      )}

      {/* Rounding (normal mode only) */}
      {mode === "normal" && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Round to nearest
          </p>
          <div className="flex gap-1.5">
            {(["none", "1", "5", "10"] as RoundMode[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoundMode(r)}
                className={chipClass(roundMode === r, "amber")}
              >
                {r === "none" ? "Exact" : `₹${r}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result card */}
      <div
        className={cn(
          "rounded-2xl border p-5 transition-all",
          result
            ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/40"
        )}
      >
        {result ? (
          mode === "normal" ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{result.breakdown}</p>
              <p className="font-mono text-4xl font-bold tracking-tight text-foreground">
                ₹{fmt(result.result)}
              </p>
              {roundMode !== "none" && (
                <p className="text-xs text-muted-foreground">
                  Exact: ₹{fmt(weightNum * result.pricePerKg)}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{result.breakdown}</p>
              <p className="font-mono text-4xl font-bold tracking-tight text-foreground">
                {fmt(result.weightOut ?? 0, 3)} kg
              </p>
              <p className="text-xs text-muted-foreground">
                = {fmt((result.weightOut ?? 0) * 1000, 0)} g
              </p>
            </div>
          )
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {mode === "normal"
              ? "Enter price and weight to calculate"
              : "Enter price and total to find weight"}
          </p>
        )}
      </div>

      {/* Clear */}
      <button
        type="button"
        onClick={handleClear}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/80 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <RotateCcw className="h-4 w-4" />
        Clear
      </button>
    </div>
  );
}
