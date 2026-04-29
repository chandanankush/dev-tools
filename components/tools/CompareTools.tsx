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

type DiffLine = {
  indent: number;
  keyPart: string;
  valuePart: string;
  status: "same" | "added" | "removed";
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
  const [jsonDiffLines, setJsonDiffLines] = useState<DiffLine[]>([]);
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
      const lines: DiffLine[] = [];
      buildDiffLines(left, right, 0, null, true, lines);
      const count = countJsonDiff(left, right);
      setJsonDiffLines(lines);
      setJsonDiffCount(count);
      setJsonError(null);
    } catch (error) {
      setJsonError((error as Error).message || "Invalid JSON input.");
      setJsonDiffLines([]);
      setJsonDiffCount(0);
    }
    setJsonCompared(true);
  };

  const swapJson = () => {
    setJsonA(jsonB);
    setJsonB(jsonA);
    setJsonDiffLines([]);
    setJsonDiffCount(0);
    setJsonError(null);
    setJsonCompared(false);
  };

  const clearJson = () => {
    setJsonA("");
    setJsonB("");
    setJsonDiffLines([]);
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
          description="Paste two JSON payloads to see a visual diff of structure and values."
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
              lines={jsonDiffLines}
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
        <div className="border-t bg-muted/20 p-4">{diffContent}</div>
      )}
    </div>
  );
}

// ─── JSON visual diff view ────────────────────────────────────────────────────

function JsonDiffView({
  lines,
  diffCount,
  error,
  compared,
}: {
  lines: DiffLine[];
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
      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-500">
        <AlertTriangle className="h-4 w-4" />
        <span>
          {diffCount} {diffCount === 1 ? "difference" : "differences"}
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-200 dark:bg-red-900/60" />
          Removed (A)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/60" />
          Added (B)
        </span>
      </div>

      {/* Diff tree */}
      <div className="overflow-auto rounded-lg border bg-card font-mono text-sm">
        <div className="min-w-max">
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start leading-6",
                line.status === "added" && "bg-emerald-50 dark:bg-emerald-950/40",
                line.status === "removed" && "bg-red-50 dark:bg-red-950/40",
              )}
            >
              {/* Gutter */}
              <span
                className={cn(
                  "w-8 shrink-0 select-none border-r py-0.5 text-center text-xs",
                  line.status === "added" &&
                    "border-emerald-200 bg-emerald-100 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/60",
                  line.status === "removed" &&
                    "border-red-200 bg-red-100 text-red-600 dark:border-red-800 dark:bg-red-950/60",
                  line.status === "same" && "border-border text-transparent",
                )}
              >
                {line.status === "added" ? "+" : line.status === "removed" ? "\u2212" : " "}
              </span>

              {/* Content */}
              <span
                className="py-0.5"
                style={{ paddingLeft: `calc(0.75rem + ${line.indent * 1.25}rem)` }}
              >
                {line.keyPart && (
                  <span className="text-blue-600 dark:text-blue-400">{line.keyPart}</span>
                )}
                <span
                  className={cn(
                    line.status === "added" && "text-emerald-700 dark:text-emerald-300",
                    line.status === "removed" && "text-red-700 dark:text-red-300",
                    line.status === "same" && "text-foreground",
                  )}
                >
                  {line.valuePart}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
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
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
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

/** Count logical differences (leaf-level changes, additions, removals). */
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
      if (i >= leftArr.length || i >= rightArr.length) {
        count += 1;
      } else {
        count += countJsonDiff(leftArr[i], rightArr[i]);
      }
    }
    return count;
  }

  if (leftType === "object") {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);
    let count = 0;
    keys.forEach((key) => {
      if (!(key in leftObj) || !(key in rightObj)) {
        count += 1;
      } else {
        count += countJsonDiff(leftObj[key], rightObj[key]);
      }
    });
    return count;
  }

  return 1;
}

/** Render any JSON value as DiffLines with a fixed status (for added/removed subtrees). */
function renderValue(
  value: unknown,
  indent: number,
  keyName: string | null,
  isLast: boolean,
  status: "same" | "added" | "removed",
  lines: DiffLine[],
): void {
  const type = getType(value);
  const keyPart = keyName !== null ? `"${keyName}": ` : "";
  const trail = isLast ? "" : ",";

  if (type === "null") {
    lines.push({ indent, keyPart, valuePart: "null" + trail, status });
    return;
  }

  if (type === "primitive") {
    lines.push({ indent, keyPart, valuePart: JSON.stringify(value) + trail, status });
    return;
  }

  if (type === "array") {
    const arr = value as unknown[];
    if (arr.length === 0) {
      lines.push({ indent, keyPart, valuePart: "[]" + trail, status });
      return;
    }
    lines.push({ indent, keyPart, valuePart: "[", status });
    arr.forEach((item, i) => {
      renderValue(item, indent + 1, null, i === arr.length - 1, status, lines);
    });
    lines.push({ indent, keyPart: "", valuePart: "]" + trail, status });
    return;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    lines.push({ indent, keyPart, valuePart: "{}" + trail, status });
    return;
  }
  lines.push({ indent, keyPart, valuePart: "{", status });
  keys.forEach((key, i) => {
    renderValue(obj[key], indent + 1, key, i === keys.length - 1, status, lines);
  });
  lines.push({ indent, keyPart: "", valuePart: "}" + trail, status });
}

/** Recursively build a git-diff-style list of DiffLines from two JSON values. */
function buildDiffLines(
  left: unknown,
  right: unknown,
  indent: number,
  keyName: string | null,
  isLast: boolean,
  lines: DiffLine[],
): void {
  const keyPart = keyName !== null ? `"${keyName}": ` : "";
  const trail = isLast ? "" : ",";

  if (JSON.stringify(left) === JSON.stringify(right)) {
    renderValue(left, indent, keyName, isLast, "same", lines);
    return;
  }

  const leftType = getType(left);
  const rightType = getType(right);

  if (leftType !== rightType || leftType === "primitive" || leftType === "null") {
    renderValue(left, indent, keyName, isLast, "removed", lines);
    renderValue(right, indent, keyName, isLast, "added", lines);
    return;
  }

  if (leftType === "object") {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const allKeys = Array.from(
      new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]),
    );

    lines.push({ indent, keyPart, valuePart: "{", status: "same" });
    allKeys.forEach((key, i) => {
      const isLastKey = i === allKeys.length - 1;
      if (!(key in leftObj)) {
        renderValue(rightObj[key], indent + 1, key, isLastKey, "added", lines);
      } else if (!(key in rightObj)) {
        renderValue(leftObj[key], indent + 1, key, isLastKey, "removed", lines);
      } else {
        buildDiffLines(leftObj[key], rightObj[key], indent + 1, key, isLastKey, lines);
      }
    });
    lines.push({ indent, keyPart: "", valuePart: "}" + trail, status: "same" });
    return;
  }

  const leftArr = left as unknown[];
  const rightArr = right as unknown[];
  const maxLen = Math.max(leftArr.length, rightArr.length);

  lines.push({ indent, keyPart, valuePart: "[", status: "same" });
  for (let i = 0; i < maxLen; i++) {
    const isLastItem = i === maxLen - 1;
    if (i >= leftArr.length) {
      renderValue(rightArr[i], indent + 1, null, isLastItem, "added", lines);
    } else if (i >= rightArr.length) {
      renderValue(leftArr[i], indent + 1, null, isLastItem, "removed", lines);
    } else {
      buildDiffLines(leftArr[i], rightArr[i], indent + 1, null, isLastItem, lines);
    }
  }
  lines.push({ indent, keyPart: "", valuePart: "]" + trail, status: "same" });
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
