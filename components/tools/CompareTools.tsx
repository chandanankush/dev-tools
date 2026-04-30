"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeftRight, Braces, CheckCircle2, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "json" | "curl";

type CurlParsed = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
};

type CurlDiffResult = {
  field: string;
  leftValue: string | null;
  rightValue: string | null;
};

/** Internal line representation used when rendering a single JSON subtree. */
type DiffLine = {
  indent: number;
  keyPart: string;
  valuePart: string;
};

/** One cell in a side-by-side row. */
type SideBySideCell = {
  indent: number;
  keyPart: string;
  valuePart: string;
  highlight: "none" | "removed" | "added" | "empty";
};

/** One row in the side-by-side diff (left = JSON A, right = JSON B). */
type SideBySideRow = {
  left: SideBySideCell;
  right: SideBySideCell;
};

// ─── Sample data ──────────────────────────────────────────────────────────────

const jsonSampleA = `{
  "name": "Service A",
  "version": "1.0.0",
  "features": ["auth", "search"],
  "limits": { "requestsPerMinute": 120 }
}`;

const jsonSampleB = `{
  "name": "Service A",
  "version": "1.1.0",
  "features": ["auth", "search", "billing"],
  "limits": { "requestsPerMinute": 200 }
}`;

const curlSampleA = `curl -X POST https://api.example.com/v1/users \
  -H "Authorization: Bearer token-a" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Ada", "email": "ada@example.com" }'`;

const curlSampleB = `curl https://api.example.com/v1/users \
  -H "Authorization: Bearer token-b" \
  -H "Content-Type: application/json" \
  --data '{ "name": "Ada", "email": "ada@example.com", "role": "admin" }'`;

// ─── Root component ───────────────────────────────────────────────────────────

export default function CompareTools() {
  const [activeTab, setActiveTab] = useState<Tab>("json");

  // JSON state
  const [jsonA, setJsonA] = useState(jsonSampleA);
  const [jsonB, setJsonB] = useState(jsonSampleB);
  const [jsonRows, setJsonRows] = useState<SideBySideRow[]>([]);
  const [jsonDiffCount, setJsonDiffCount] = useState(0);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonCompared, setJsonCompared] = useState(false);

  // cURL state
  const [curlA, setCurlA] = useState(curlSampleA);
  const [curlB, setCurlB] = useState(curlSampleB);
  const [curlDiff, setCurlDiff] = useState<CurlDiffResult[]>([]);
  const [curlError, setCurlError] = useState<string | null>(null);
  const [curlCompared, setCurlCompared] = useState(false);

  // ─── JSON handlers ────────────────────────────────────────────────────────

  const handleJsonCompare = () => {
    try {
      const left = JSON.parse(jsonA);
      const right = JSON.parse(jsonB);
      const rows: SideBySideRow[] = [];
      buildSideBySideRows(left, right, 0, null, true, rows);
      const count = countJsonDiff(left, right);
      setJsonRows(rows);
      setJsonDiffCount(count);
      setJsonError(null);
    } catch (error) {
      setJsonError((error as Error).message || "Invalid JSON input.");
      setJsonRows([]);
      setJsonDiffCount(0);
    }
    setJsonCompared(true);
  };

  const swapJson = () => {
    setJsonA(jsonB);
    setJsonB(jsonA);
    setJsonRows([]);
    setJsonDiffCount(0);
    setJsonError(null);
    setJsonCompared(false);
  };

  const clearJson = () => {
    setJsonA("");
    setJsonB("");
    setJsonRows([]);
    setJsonDiffCount(0);
    setJsonError(null);
    setJsonCompared(false);
  };

  // ─── cURL handlers ────────────────────────────────────────────────────────

  const handleCurlCompare = () => {
    try {
      const left = parseCurl(curlA);
      const right = parseCurl(curlB);
      const diff = diffCurl(left, right);
      setCurlDiff(diff);
      setCurlError(null);
    } catch (error) {
      setCurlError((error as Error).message || "Unable to parse cURL commands.");
      setCurlDiff([]);
    }
    setCurlCompared(true);
  };

  const swapCurl = () => {
    setCurlA(curlB);
    setCurlB(curlA);
    setCurlDiff([]);
    setCurlError(null);
    setCurlCompared(false);
  };

  const clearCurl = () => {
    setCurlA("");
    setCurlB("");
    setCurlDiff([]);
    setCurlError(null);
    setCurlCompared(false);
  };

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-sm">
        <button
          onClick={() => setActiveTab("json")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "json"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Braces className="h-4 w-4" />
          JSON Compare
        </button>
        <button
          onClick={() => setActiveTab("curl")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "curl"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Terminal className="h-4 w-4" />
          cURL Compare
        </button>
      </div>

      {/* JSON panel */}
      {activeTab === "json" && (
        <ComparePanel
          title="JSON Compare"
          description="Paste two JSON payloads to see a side-by-side visual diff."
          leftLabel="JSON A"
          rightLabel="JSON B"
          leftValue={jsonA}
          rightValue={jsonB}
          onLeftChange={(v) => { setJsonA(v); setJsonCompared(false); }}
          onRightChange={(v) => { setJsonB(v); setJsonCompared(false); }}
          onCompare={handleJsonCompare}
          onSwap={swapJson}
          onClear={clearJson}
          diffContent={
            <JsonDiffView
              rows={jsonRows}
              diffCount={jsonDiffCount}
              error={jsonError}
              compared={jsonCompared}
            />
          }
        />
      )}

      {/* cURL panel */}
      {activeTab === "curl" && (
        <ComparePanel
          title="cURL Compare"
          description="Compare two curl commands by method, URL, headers, and body."
          leftLabel="cURL A"
          rightLabel="cURL B"
          leftValue={curlA}
          rightValue={curlB}
          onLeftChange={(v) => { setCurlA(v); setCurlCompared(false); }}
          onRightChange={(v) => { setCurlB(v); setCurlCompared(false); }}
          onCompare={handleCurlCompare}
          onSwap={swapCurl}
          onClear={clearCurl}
          diffContent={
            <CurlDiffView
              diff={curlDiff}
              error={curlError}
              compared={curlCompared}
            />
          }
        />
      )}
    </div>
  );
}

// ─── ComparePanel shell ───────────────────────────────────────────────────────

interface ComparePanelProps {
  title: string;
  description: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: string;
  rightValue: string;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onCompare: () => void;
  onSwap: () => void;
  onClear: () => void;
  diffContent: React.ReactNode;
}

function ComparePanel({
  title,
  description,
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  onLeftChange,
  onRightChange,
  onCompare,
  onSwap,
  onClear,
  diffContent,
}: ComparePanelProps) {
  return (
    <div className="space-y-4 rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <p className="text-sm font-semibold text-card-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onCompare}>
            Compare
          </Button>
          <Button variant="secondary" size="sm" onClick={onSwap}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Swap
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>

      {/* Input textareas */}
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{leftLabel}</Label>
          <Textarea
            value={leftValue}
            onChange={(e) => onLeftChange(e.target.value)}
            className="min-h-[260px] font-mono text-sm"
            spellCheck={false}
          />
        </div>
        <div className="space-y-2">
          <Label>{rightLabel}</Label>
          <Textarea
            value={rightValue}
            onChange={(e) => onRightChange(e.target.value)}
            className="min-h-[260px] font-mono text-sm"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Diff output */}
      {diffContent && (
        <div className="border-t bg-muted/40 p-4">{diffContent}</div>
      )}
    </div>
  );
}

// ─── JSON side-by-side diff view ─────────────────────────────────────────────

function JsonDiffView({
  rows,
  diffCount,
  error,
  compared,
}: {
  rows: SideBySideRow[];
  diffCount: number;
  error: string | null;
  compared: boolean;
}) {
  if (!compared) return null;

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (diffCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
        <span>JSON match</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <span>{diffCount} {diffCount === 1 ? "difference" : "differences"}</span>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-200 dark:bg-red-900/60" />
            JSON A (removed)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/60" />
            JSON B (added)
          </span>
        </div>
      </div>

      {/* Side-by-side grid */}
      <div className="overflow-auto rounded-lg border bg-card font-mono text-sm">
        {/* Column headers */}
        <div className="grid grid-cols-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          <div className="px-3 py-1.5 border-r">JSON A</div>
          <div className="px-3 py-1.5">JSON B</div>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-2 border-b border-border/60 last:border-0">
            <DiffCell cell={row.left} side="left" />
            <DiffCell cell={row.right} side="right" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffCell({ cell, side }: { cell: SideBySideCell; side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className={cn(
        "min-h-[1.5rem] py-0.5 leading-6",
        isLeft && "border-r border-border/60",
        cell.highlight === "removed" && "bg-red-50 dark:bg-red-950/40",
        cell.highlight === "added" && "bg-emerald-50 dark:bg-emerald-950/40",
        cell.highlight === "empty" && "bg-muted/40",
      )}
      style={{ paddingLeft: `calc(0.75rem + ${cell.indent * 1.25}rem)`, paddingRight: "0.75rem" }}
    >
      {cell.highlight === "empty" ? null : (
        <>
          {cell.keyPart && (
            <span className="text-blue-600 dark:text-blue-400">{cell.keyPart}</span>
          )}
          <span
            className={cn(
              cell.highlight === "removed" && "text-red-700 dark:text-red-300",
              cell.highlight === "added" && "text-emerald-700 dark:text-emerald-300",
              cell.highlight === "none" && "text-foreground",
            )}
          >
            {cell.valuePart}
          </span>
        </>
      )}
    </div>
  );
}

// ─── cURL visual diff view ────────────────────────────────────────────────────

function CurlDiffView({
  diff,
  error,
  compared,
}: {
  diff: CurlDiffResult[];
  error: string | null;
  compared: boolean;
}) {
  if (!compared) return null;

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (diff.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
        <span>Commands match</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-500">
        <AlertTriangle className="h-4 w-4" />
        <span>
          {diff.length} {diff.length === 1 ? "difference" : "differences"}
        </span>
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Field</th>
              <th className="px-3 py-2 text-left font-medium">cURL A</th>
              <th className="px-3 py-2 text-left font-medium">cURL B</th>
            </tr>
          </thead>
          <tbody>
            {diff.map((item) => (
              <tr key={item.field} className="border-t">
                <td className="px-3 py-2 font-medium text-muted-foreground">{item.field}</td>
                <td className="px-3 py-2">
                  {item.leftValue === null ? (
                    <span className="italic text-muted-foreground">&mdash;</span>
                  ) : (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {item.leftValue}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {item.rightValue === null ? (
                    <span className="italic text-muted-foreground">&mdash;</span>
                  ) : (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {item.rightValue}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── JSON diff helpers ────────────────────────────────────────────────────────

function getType(value: unknown): "object" | "array" | "null" | "primitive" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "primitive";
}

/** Count leaf-level differences recursively. */
function countJsonDiff(left: unknown, right: unknown): number {
  if (JSON.stringify(left) === JSON.stringify(right)) return 0;

  const leftType = getType(left);
  const rightType = getType(right);

  if (leftType !== rightType) return 1;

  if (leftType === "array") {
    const leftArr = left as unknown[];
    const rightArr = right as unknown[];
    const maxLen = Math.max(leftArr.length, rightArr.length);
    let count = 0;
    for (let i = 0; i < maxLen; i++) {
      if (i >= leftArr.length || i >= rightArr.length) count += 1;
      else count += countJsonDiff(leftArr[i], rightArr[i]);
    }
    return count;
  }

  if (leftType === "object") {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);
    let count = 0;
    keys.forEach((key) => {
      if (!(key in leftObj) || !(key in rightObj)) count += 1;
      else count += countJsonDiff(leftObj[key], rightObj[key]);
    });
    return count;
  }

  return 1;
}

/**
 * Render a single JSON value as a flat list of DiffLines (used internally
 * to expand one side of a changed/added/removed subtree).
 */
function renderLines(
  value: unknown,
  indent: number,
  keyName: string | null,
  isLast: boolean,
  out: DiffLine[],
): void {
  const type = getType(value);
  const keyPart = keyName !== null ? `"${keyName}": ` : "";
  const trail = isLast ? "" : ",";

  if (type === "null") {
    out.push({ indent, keyPart, valuePart: "null" + trail });
    return;
  }
  if (type === "primitive") {
    out.push({ indent, keyPart, valuePart: JSON.stringify(value) + trail });
    return;
  }
  if (type === "array") {
    const arr = value as unknown[];
    if (arr.length === 0) { out.push({ indent, keyPart, valuePart: "[]" + trail }); return; }
    out.push({ indent, keyPart, valuePart: "[" });
    arr.forEach((item, i) => renderLines(item, indent + 1, null, i === arr.length - 1, out));
    out.push({ indent, keyPart: "", valuePart: "]" + trail });
    return;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) { out.push({ indent, keyPart, valuePart: "{}" + trail }); return; }
  out.push({ indent, keyPart, valuePart: "{" });
  keys.forEach((key, i) => renderLines(obj[key], indent + 1, key, i === keys.length - 1, out));
  out.push({ indent, keyPart: "", valuePart: "}" + trail });
}

/** Convert a flat DiffLine list into same-highlight SideBySideCells on one side, empty on the other. */
function linesToRows(
  lines: DiffLine[],
  highlight: "removed" | "added",
  side: "left" | "right",
): SideBySideRow[] {
  const empty: SideBySideCell = { indent: 0, keyPart: "", valuePart: "", highlight: "empty" };
  return lines.map((line) => {
    const cell: SideBySideCell = { indent: line.indent, keyPart: line.keyPart, valuePart: line.valuePart, highlight };
    return side === "left"
      ? { left: cell, right: empty }
      : { left: empty, right: cell };
  });
}

/**
 * Recursively build side-by-side rows by comparing two JSON values.
 * Identical subtrees produce rows where both sides are identical (highlight "none").
 * Changed subtrees produce rows where the left side is highlighted "removed"
 * and the right side is highlighted "added".
 */
function buildSideBySideRows(
  left: unknown,
  right: unknown,
  indent: number,
  keyName: string | null,
  isLast: boolean,
  rows: SideBySideRow[],
): void {
  const keyPart = keyName !== null ? `"${keyName}": ` : "";
  const trail = isLast ? "" : ",";

  // Identical subtree — context rows, both sides same
  if (JSON.stringify(left) === JSON.stringify(right)) {
    const lines: DiffLine[] = [];
    renderLines(left, indent, keyName, isLast, lines);
    lines.forEach((line) => {
      const cell: SideBySideCell = { indent: line.indent, keyPart: line.keyPart, valuePart: line.valuePart, highlight: "none" };
      rows.push({ left: cell, right: { ...cell } });
    });
    return;
  }

  const leftType = getType(left);
  const rightType = getType(right);

  // Type mismatch or primitive change — pair left lines (removed) with right lines (added)
  if (leftType !== rightType || leftType === "primitive" || leftType === "null") {
    const leftLines: DiffLine[] = [];
    const rightLines: DiffLine[] = [];
    renderLines(left, indent, keyName, isLast, leftLines);
    renderLines(right, indent, keyName, isLast, rightLines);
    const maxLen = Math.max(leftLines.length, rightLines.length);
    const emptyCell: SideBySideCell = { indent, keyPart: "", valuePart: "", highlight: "empty" };
    for (let i = 0; i < maxLen; i++) {
      const l = leftLines[i];
      const r = rightLines[i];
      rows.push({
        left: l ? { indent: l.indent, keyPart: l.keyPart, valuePart: l.valuePart, highlight: "removed" } : emptyCell,
        right: r ? { indent: r.indent, keyPart: r.keyPart, valuePart: r.valuePart, highlight: "added" } : emptyCell,
      });
    }
    return;
  }

  // Both objects — recurse per key
  if (leftType === "object") {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const allKeys = Array.from(new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]));

    const openCell: SideBySideCell = { indent, keyPart, valuePart: "{", highlight: "none" };
    rows.push({ left: openCell, right: { ...openCell } });

    allKeys.forEach((key, i) => {
      const isLastKey = i === allKeys.length - 1;
      if (!(key in leftObj)) {
        const addedLines: DiffLine[] = [];
        renderLines(rightObj[key], indent + 1, key, isLastKey, addedLines);
        rows.push(...linesToRows(addedLines, "added", "right"));
      } else if (!(key in rightObj)) {
        const removedLines: DiffLine[] = [];
        renderLines(leftObj[key], indent + 1, key, isLastKey, removedLines);
        rows.push(...linesToRows(removedLines, "removed", "left"));
      } else {
        buildSideBySideRows(leftObj[key], rightObj[key], indent + 1, key, isLastKey, rows);
      }
    });

    const closeCell: SideBySideCell = { indent, keyPart: "", valuePart: "}" + trail, highlight: "none" };
    rows.push({ left: closeCell, right: { ...closeCell } });
    return;
  }

  // Both arrays — recurse per index
  const leftArr = left as unknown[];
  const rightArr = right as unknown[];
  const maxLen = Math.max(leftArr.length, rightArr.length);

  const openCell: SideBySideCell = { indent, keyPart, valuePart: "[", highlight: "none" };
  rows.push({ left: openCell, right: { ...openCell } });

  for (let i = 0; i < maxLen; i++) {
    const isLastItem = i === maxLen - 1;
    if (i >= leftArr.length) {
      const addedLines: DiffLine[] = [];
      renderLines(rightArr[i], indent + 1, null, isLastItem, addedLines);
      rows.push(...linesToRows(addedLines, "added", "right"));
    } else if (i >= rightArr.length) {
      const removedLines: DiffLine[] = [];
      renderLines(leftArr[i], indent + 1, null, isLastItem, removedLines);
      rows.push(...linesToRows(removedLines, "removed", "left"));
    } else {
      buildSideBySideRows(leftArr[i], rightArr[i], indent + 1, null, isLastItem, rows);
    }
  }

  const closeCell: SideBySideCell = { indent, keyPart: "", valuePart: "]" + trail, highlight: "none" };
  rows.push({ left: closeCell, right: { ...closeCell } });
}

// ─── cURL helpers ─────────────────────────────────────────────────────────────

function parseCurl(command: string): CurlParsed {
  const tokens = tokenize(command);

  if (tokens.length === 0) {
    throw new Error("Enter a curl command to compare.");
  }

  if (tokens[0].toLowerCase() === "curl") {
    tokens.shift();
  }

  let method = "GET";
  let url = "";
  const headers: Record<string, string> = {};
  let body: string | null = null;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    switch (token) {
      case "-X":
      case "--request":
        method = (tokens[i + 1] || "GET").toUpperCase();
        i += 1;
        break;
      case "-H":
      case "--header": {
        const header = tokens[i + 1] || "";
        const [name, ...rest] = header.split(":");
        if (name) {
          headers[name.trim().toLowerCase()] = rest.join(":").trim();
        }
        i += 1;
        break;
      }
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-binary":
        body = tokens[i + 1] ?? "";
        i += 1;
        break;
      case "--url":
        url = tokens[i + 1] ?? url;
        i += 1;
        break;
      default:
        if (!token.startsWith("-") && !url) {
          url = token;
        }
        break;
    }
  }

  if (body && method === "GET") {
    method = "POST";
  }

  if (!url) {
    throw new Error("Could not find a URL in the curl command.");
  }

  return { method, url, headers, body };
}

function diffCurl(left: CurlParsed, right: CurlParsed): CurlDiffResult[] {
  const differences: CurlDiffResult[] = [];

  if (left.method !== right.method) {
    differences.push({ field: "method", leftValue: left.method, rightValue: right.method });
  }

  if (left.url !== right.url) {
    differences.push({ field: "url", leftValue: left.url, rightValue: right.url });
  }

  const headerKeys = new Set([...Object.keys(left.headers), ...Object.keys(right.headers)]);
  headerKeys.forEach((key) => {
    const lVal = left.headers[key];
    const rVal = right.headers[key];
    if (lVal === rVal) return;
    differences.push({
      field: `header: ${key}`,
      leftValue: lVal ?? null,
      rightValue: rVal ?? null,
    });
  });

  if ((left.body ?? "") !== (right.body ?? "")) {
    differences.push({
      field: "body",
      leftValue: left.body ?? null,
      rightValue: right.body ?? null,
    });
  }

  return differences;
}

function tokenize(input: string): string[] {
  const cleaned = input.replace(/\\\n/g, " ").trim();
  const tokens: string[] = [];
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    const [, doubleQuoted, singleQuoted] = match;
    if (doubleQuoted !== undefined) {
      tokens.push(unescapeQuoted(doubleQuoted));
    } else if (singleQuoted !== undefined) {
      tokens.push(unescapeQuoted(singleQuoted));
    } else {
      tokens.push(match[0]);
    }
  }

  return tokens;
}

function unescapeQuoted(value: string): string {
  return value.replace(/\\([\\"])/g, "$1");
}
