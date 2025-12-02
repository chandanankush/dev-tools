"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Braces, CheckCircle2, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tab = "json" | "curl";

type CurlParsed = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
};

type DiffItem = {
  path: string;
  message: string;
};

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

const curlSampleA = `curl -X POST https://api.example.com/v1/users \\
  -H "Authorization: Bearer token-a" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Ada", "email": "ada@example.com" }'`;

const curlSampleB = `curl https://api.example.com/v1/users \\
  -H "Authorization: Bearer token-b" \\
  -H "Content-Type: application/json" \\
  --data '{ "name": "Ada", "email": "ada@example.com", "role": "admin" }'`;

export default function CompareTools() {
  const [activeTab, setActiveTab] = useState<Tab>("json");

  const [jsonA, setJsonA] = useState(jsonSampleA);
  const [jsonB, setJsonB] = useState(jsonSampleB);
  const [jsonDiff, setJsonDiff] = useState<DiffItem[]>([]);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [curlA, setCurlA] = useState(curlSampleA);
  const [curlB, setCurlB] = useState(curlSampleB);
  const [curlDiff, setCurlDiff] = useState<DiffItem[]>([]);
  const [curlError, setCurlError] = useState<string | null>(null);

  const jsonSummary = useMemo(() => {
    if (jsonError) return "Invalid JSON";
    return jsonDiff.length === 0 ? "JSON match" : `${jsonDiff.length} difference${jsonDiff.length === 1 ? "" : "s"}`;
  }, [jsonDiff.length, jsonError]);

  const curlSummary = useMemo(() => {
    if (curlError) return "Unable to parse cURL";
    return curlDiff.length === 0 ? "Commands match" : `${curlDiff.length} difference${curlDiff.length === 1 ? "" : "s"}`;
  }, [curlDiff.length, curlError]);

  const handleJsonCompare = () => {
    try {
      const left = JSON.parse(jsonA);
      const right = JSON.parse(jsonB);
      const diff = diffJson(left, right);
      setJsonDiff(diff);
      setJsonError(null);
    } catch (error) {
      setJsonError((error as Error).message || "Invalid JSON input.");
      setJsonDiff([]);
    }
  };

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
  };

  const swapJson = () => {
    setJsonA(jsonB);
    setJsonB(jsonA);
    setJsonDiff([]);
    setJsonError(null);
  };

  const swapCurl = () => {
    setCurlA(curlB);
    setCurlB(curlA);
    setCurlDiff([]);
    setCurlError(null);
  };

  const clearJson = () => {
    setJsonA("");
    setJsonB("");
    setJsonDiff([]);
    setJsonError(null);
  };

  const clearCurl = () => {
    setCurlA("");
    setCurlB("");
    setCurlDiff([]);
    setCurlError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-sm">
        <button
          onClick={() => setActiveTab("json")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "json"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Terminal className="h-4 w-4" />
          cURL Compare
        </button>
      </div>

      {activeTab === "json" ? (
        <ComparePanel
          title="JSON Compare"
          description="Paste two JSON payloads to see structure and value differences."
          leftLabel="JSON A"
          rightLabel="JSON B"
          leftValue={jsonA}
          rightValue={jsonB}
          onLeftChange={setJsonA}
          onRightChange={setJsonB}
          onCompare={handleJsonCompare}
          onSwap={swapJson}
          onClear={clearJson}
          diff={jsonDiff}
          error={jsonError}
          summary={jsonSummary}
        />
      ) : (
        <ComparePanel
          title="cURL Compare"
          description="Compare two curl commands by method, URL, headers, and body."
          leftLabel="cURL A"
          rightLabel="cURL B"
          leftValue={curlA}
          rightValue={curlB}
          onLeftChange={setCurlA}
          onRightChange={setCurlB}
          onCompare={handleCurlCompare}
          onSwap={swapCurl}
          onClear={clearCurl}
          diff={curlDiff}
          error={curlError}
          summary={curlSummary}
        />
      )}
    </div>
  );
}

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
  diff: DiffItem[];
  error: string | null;
  summary: string;
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
  diff,
  error,
  summary,
}: ComparePanelProps) {
  return (
    <div className="space-y-4 rounded-xl border bg-card shadow-sm">
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

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{leftLabel}</Label>
          <Textarea
            value={leftValue}
            onChange={(event) => onLeftChange(event.target.value)}
            className="min-h-[260px] font-mono text-sm"
            spellCheck={false}
          />
        </div>
        <div className="space-y-2">
          <Label>{rightLabel}</Label>
          <Textarea
            value={rightValue}
            onChange={(event) => onRightChange(event.target.value)}
            className="min-h-[260px] font-mono text-sm"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="border-t bg-muted/40 p-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : diff.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>{summary}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span>{summary}</span>
            </div>
            <ul className="space-y-1 text-sm text-card-foreground">
              {diff.map((item) => (
                <li key={`${item.path}-${item.message}`} className="rounded-md bg-background/80 px-3 py-2">
                  <span className="font-semibold text-muted-foreground">{item.path}:</span>{" "}
                  <span>{item.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function diffJson(left: unknown, right: unknown, path = "root"): DiffItem[] {
  const differences: DiffItem[] = [];

  if (left === right) {
    return differences;
  }

  const leftType = getType(left);
  const rightType = getType(right);

  if (leftType !== rightType) {
    differences.push({
      path,
      message: `Type mismatch (${leftType} vs ${rightType})`,
    });
    return differences;
  }

  if (leftType === "array") {
    const maxLength = Math.max((left as unknown[]).length, (right as unknown[]).length);
    for (let i = 0; i < maxLength; i += 1) {
      const lVal = (left as unknown[])[i];
      const rVal = (right as unknown[])[i];
      const nextPath = `${path}[${i}]`;
      if (i >= (left as unknown[]).length) {
        differences.push({ path: nextPath, message: "Missing on the left" });
      } else if (i >= (right as unknown[]).length) {
        differences.push({ path: nextPath, message: "Missing on the right" });
      } else {
        differences.push(...diffJson(lVal, rVal, nextPath));
      }
    }
    return differences;
  }

  if (leftType === "object") {
    const keys = new Set([...Object.keys(left as Record<string, unknown>), ...Object.keys(right as Record<string, unknown>)]);
    keys.forEach((key) => {
      const lVal = (left as Record<string, unknown>)[key];
      const rVal = (right as Record<string, unknown>)[key];
      const nextPath = `${path}.${key}`;
      if (!(key in (left as Record<string, unknown>))) {
        differences.push({ path: nextPath, message: "Missing on the left" });
      } else if (!(key in (right as Record<string, unknown>))) {
        differences.push({ path: nextPath, message: "Missing on the right" });
      } else {
        differences.push(...diffJson(lVal, rVal, nextPath));
      }
    });
    return differences;
  }

  // Primitive mismatch at this point.
  differences.push({
    path,
    message: `Value mismatch (${JSON.stringify(left)} vs ${JSON.stringify(right)})`,
  });

  return differences;
}

function getType(value: unknown): "object" | "array" | "null" | "primitive" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "primitive";
}

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
      default: {
        if (!token.startsWith("-") && !url) {
          url = token;
        }
        break;
      }
    }
  }

  if (body && method === "GET") {
    method = "POST";
  }

  if (!url) {
    throw new Error("Could not find a URL in the curl command.");
  }

  return {
    method,
    url,
    headers,
    body,
  };
}

function diffCurl(left: CurlParsed, right: CurlParsed): DiffItem[] {
  const differences: DiffItem[] = [];

  if (left.method !== right.method) {
    differences.push({
      path: "method",
      message: `${left.method} vs ${right.method}`,
    });
  }

  if (left.url !== right.url) {
    differences.push({
      path: "url",
      message: `${left.url} vs ${right.url}`,
    });
  }

  const headerKeys = new Set([...Object.keys(left.headers), ...Object.keys(right.headers)]);
  headerKeys.forEach((key) => {
    const lVal = left.headers[key];
    const rVal = right.headers[key];
    if (lVal === rVal) return;
    if (lVal === undefined) {
      differences.push({ path: `header:${key}`, message: "Missing on the left" });
    } else if (rVal === undefined) {
      differences.push({ path: `header:${key}`, message: "Missing on the right" });
    } else {
      differences.push({ path: `header:${key}`, message: `${lVal} vs ${rVal}` });
    }
  });

  if ((left.body ?? "") !== (right.body ?? "")) {
    differences.push({
      path: "body",
      message: `${left.body ?? "(empty)"} vs ${right.body ?? "(empty)"}`,
    });
  }

  return differences;
}

function tokenize(input: string): string[] {
  const cleaned = input.replace(/\\\n/g, " ").trim();
  const tokens: string[] = [];
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\\S+/g;
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

function unescapeQuoted(value: string) {
  return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
