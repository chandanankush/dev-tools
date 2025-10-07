"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  ClipboardPaste,
  ClipboardPen,
  Download,
  FileJson,
  RefreshCw,
  Rows3,
  Search,
  Share2,
  Trash,
  TreePine,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

type ParseResult = {
  data: JsonValue | null;
  error: string | null;
  nodeCount: number;
  sizeBytes: number;
  parseTimeMs: number;
};

const sampleJson = {
  name: "Dev Toolkit",
  version: "1.0.0",
  metadata: {
    authors: ["Avery", "Jordan"],
    license: "MIT",
    repository: "https://github.com/example/dev-toolkit",
  },
  scripts: {
    dev: "next dev",
    build: "next build",
    lint: "pnpm lint",
  },
  features: [
    { slug: "json-prettifier", title: "JSON Prettifier", status: "stable" },
    { slug: "uuid-generator", title: "UUID Generator", status: "beta" },
    { slug: "json-viewer", title: "JSON Viewer", status: "prototype" },
  ],
  settings: {
    theme: "system",
    wrapMode: true,
    searchType: "fuzzy",
  },
};

const sampleJsonText = JSON.stringify(sampleJson, null, 2);

function countNodes(value: JsonValue): number {
  if (value === null) {
    return 1;
  }
  if (Array.isArray(value)) {
    return value.reduce((acc, item) => acc + countNodes(item), 1);
  }
  if (typeof value === "object") {
    return Object.values(value).reduce((acc, item) => acc + countNodes(item), 1);
  }
  return 1;
}

function collectPaths(value: JsonValue, basePath: string, target: Record<string, boolean>) {
  target[basePath] = true;
  if (value === null) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPaths(item, `${basePath}/${index}`, target));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, val]) => collectPaths(val, `${basePath}/${key}`, target));
  }
}

function findMatches(value: JsonValue, basePath: string, query: string, matches: string[]) {
  if (!query) {
    return;
  }
  const normalizedQuery = query.toLowerCase();
  if (basePath !== "root") {
    const normalizedPath = basePath.replace(/^root\/?/, "").toLowerCase();
    if (normalizedPath.includes(normalizedQuery)) {
      matches.push(basePath);
    }
  }
  if (value === null) {
    if ("null".includes(normalizedQuery)) {
      matches.push(basePath);
    }
    return;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (String(value).toLowerCase().includes(normalizedQuery)) {
      matches.push(basePath);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findMatches(item, `${basePath}/${index}`, query, matches));
    return;
  }
  Object.entries(value).forEach(([key, val]) => {
    if (key.toLowerCase().includes(normalizedQuery)) {
      matches.push(`${basePath}/${key}`);
    }
    findMatches(val, `${basePath}/${key}`, query, matches);
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type TreeNodeProps = {
  value: JsonValue;
  path: string;
  depth: number;
  label: string;
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  matches: Set<string>;
  searchTerm: string;
  activePath: string;
  onCopyPath: (path: string) => void;
};

function JsonTreeNode({
  value,
  path,
  depth,
  label,
  expanded,
  onToggle,
  onSelect,
  matches,
  searchTerm,
  activePath,
  onCopyPath,
}: TreeNodeProps) {
  const isExpandable = value !== null && typeof value === "object" && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);
  const isOpen = expanded[path] ?? depth === 0;
  const isMatch = matches.has(path);
  const isActive = activePath === path;

  const typeLabel = Array.isArray(value)
    ? `Array(${value.length})`
    : value === null
    ? "null"
    : typeof value;

  const preview = useMemo(() => {
    if (Array.isArray(value)) {
      return value.length ? `[…]` : "[]";
    }
    if (value && typeof value === "object") {
      const keys = Object.keys(value);
      return keys.length ? `{…}` : "{}";
    }
    if (typeof value === "string") {
      const truncated = value.length > 32 ? `${value.slice(0, 32)}…` : value;
      return `"${truncated}"`;
    }
    return String(value);
  }, [value]);

  const highlight = (text: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(escapeRegExp(searchTerm), "gi");
    return text.split(regex).reduce<ReactNode[]>((acc, part, index, arr) => {
      acc.push(part);
      if (index < arr.length - 1) {
        acc.push(
          <mark key={`${path}-highlight-${index}`} className="rounded bg-primary/20 px-1 py-0.5 text-primary">
            {searchTerm}
          </mark>
        );
      }
      return acc;
    }, []);
  };

  return (
    <div className="space-y-1">
      <div
        className={
          "flex items-start gap-2 rounded-lg border border-transparent px-2 py-1 transition hover:border-border hover:bg-muted/60"
        }
        style={{ marginLeft: depth * 16 }}
        role="treeitem"
        aria-expanded={isExpandable ? isOpen : undefined}
        aria-selected={isActive}
      >
        <button
          type="button"
          className="mt-1 flex h-5 w-5 items-center justify-center rounded border border-border/70 bg-card text-muted-foreground hover:bg-muted"
          onClick={() => {
            if (isExpandable) {
              onToggle(path);
            }
          }}
          aria-label={isExpandable ? `${isOpen ? "Collapse" : "Expand"} ${label}` : undefined}
        >
          {isExpandable ? (
            isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="h-1 w-1" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect(path)}
          className={`flex flex-1 flex-col items-start rounded-lg text-left ${
            isActive ? "bg-primary/10" : ""
          }`}
        >
          <div className="flex w-full items-center gap-2">
            <span className="text-sm font-medium text-card-foreground">
              {highlight(label)}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{typeLabel}</span>
            {isMatch && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">match</span>}
          </div>
          <span className="text-sm text-muted-foreground">{highlight(preview)}</span>
        </button>
        <button
          type="button"
          onClick={() => onCopyPath(path)}
          className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded border border-border/80 text-muted-foreground transition hover:bg-muted"
          aria-label="Copy JSON path"
        >
          <ClipboardList className="h-4 w-4" />
        </button>
      </div>
      {isExpandable && isOpen && (
        <div role="group" className="space-y-1">
          {Array.isArray(value)
            ? value.map((item, index) => (
                <JsonTreeNode
                  key={`${path}/${index}`}
                  value={item}
                  path={`${path}/${index}`}
                  depth={depth + 1}
                  label={`[${index}]`}
                  expanded={expanded}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  matches={matches}
                  searchTerm={searchTerm}
                  activePath={activePath}
                  onCopyPath={onCopyPath}
                />
              ))
            : value &&
              typeof value === "object" &&
              Object.entries(value).map(([key, val]) => (
                <JsonTreeNode
                  key={`${path}/${key}`}
                  value={val}
                  path={`${path}/${key}`}
                  depth={depth + 1}
                  label={key}
                  expanded={expanded}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  matches={matches}
                  searchTerm={searchTerm}
                  activePath={activePath}
                  onCopyPath={onCopyPath}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export default function JsonViewer() {
  const [jsonText, setJsonText] = useState(sampleJsonText);
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [activePath, setActivePath] = useState("root");
  const [shareCopied, setShareCopied] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  const parseResult: ParseResult = useMemo(() => {
    const canMeasure = typeof window !== "undefined" && hasHydrated && typeof performance !== "undefined";
    const start = canMeasure ? performance.now() : 0;
    try {
      const value: JsonValue = jsonText.trim() ? JSON.parse(jsonText) : null;
      return {
        data: value,
        error: null,
        nodeCount: value ? countNodes(value) : 0,
        sizeBytes: new TextEncoder().encode(jsonText).length,
        parseTimeMs: canMeasure ? performance.now() - start : 0,
      };
    } catch (error) {
      return {
        data: null,
        error: (error as Error).message,
        nodeCount: 0,
        sizeBytes: new TextEncoder().encode(jsonText).length,
        parseTimeMs: canMeasure ? performance.now() - start : 0,
      };
    }
  }, [jsonText, hasHydrated]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const matches = useMemo(() => {
    if (!searchTerm || !parseResult.data) {
      return [] as string[];
    }
    const found: string[] = [];
    findMatches(parseResult.data, "root", searchTerm, found);
    return Array.from(new Set(found));
  }, [parseResult.data, searchTerm]);

  useEffect(() => {
    setCurrentMatchIndex(0);
    if (!searchTerm || !parseResult.data) {
      return;
    }
    setExpanded((prev) => {
      const next = { ...prev };
      matches.forEach((path) => {
        const segments = path.split("/");
        segments.reduce((acc, segment) => {
          const nextPath = acc ? `${acc}/${segment}` : segment;
          next[nextPath] = true;
          return nextPath;
        }, "" as string);
      });
      next.root = true;
      return next;
    });
  }, [matches, parseResult.data, searchTerm]);

  useEffect(() => {
    if (!copiedPath) return;
    const timer = window.setTimeout(() => setCopiedPath(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedPath]);

  useEffect(() => {
    if (!shareCopied) return;
    const timer = window.setTimeout(() => setShareCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [shareCopied]);

  const matchesSet = useMemo(() => new Set(matches), [matches]);
  const currentMatchPath = matches[currentMatchIndex] ?? null;

  const handleToggle = useCallback((path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const handleExpandAll = useCallback(() => {
    if (!parseResult.data) return;
    const next: Record<string, boolean> = {};
    collectPaths(parseResult.data, "root", next);
    setExpanded(next);
  }, [parseResult.data]);

  const handleCollapseAll = useCallback(() => {
    setExpanded({ root: true });
  }, []);

  const handlePaste = useCallback(async () => {
    if (!navigator.clipboard) return;
    const text = await navigator.clipboard.readText();
    if (text) {
      setJsonText(text);
    }
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "json-viewer-export.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [jsonText]);

  const handleShare = useCallback(async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${origin}/tools/json-viewer?data=${encodeURIComponent(jsonText)}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
    }
  }, [jsonText]);

  const handleCopyPath = useCallback((path: string) => {
    if (!navigator.clipboard) return;
    const readablePath = path.replace(/^root\/?/, "").replace(/\//g, ".") || "root";
    navigator.clipboard.writeText(readablePath);
    setCopiedPath(readablePath);
  }, []);

  useEffect(() => {
    if (!parseResult.data) {
      setExpanded({ root: true });
      return;
    }
    setExpanded((prev) => ({ root: true, ...prev }));
  }, [parseResult.data]);

  const breadcrumbs = useMemo(() => {
    const segments = activePath.replace(/^root\/?/, "").split("/").filter(Boolean);
    return ["root", ...segments];
  }, [activePath]);

  const renderTree = () => {
    if (!parseResult.data) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/40 p-6 text-center">
          <FileJson className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {parseResult.error ? parseResult.error : "Paste or load JSON to start exploring."}
          </p>
        </div>
      );
    }

    return (
      <div className="max-h-[420px] overflow-auto rounded-xl border bg-card p-3" role="tree" aria-label="JSON tree view">
        <JsonTreeNode
          value={parseResult.data}
          path="root"
          depth={0}
          label="root"
          expanded={expanded}
          onToggle={handleToggle}
          onSelect={setActivePath}
          matches={matchesSet}
          searchTerm={searchTerm}
          activePath={currentMatchPath ?? activePath}
          onCopyPath={handleCopyPath}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePaste} className="inline-flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4" /> Paste
            </Button>
            <Button variant="outline" size="sm" onClick={() => setJsonText("")} className="inline-flex items-center gap-2">
              <Trash className="h-4 w-4" /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => setJsonText(sampleJsonText)} className="inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Load Sample
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="inline-flex items-center gap-2">
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} className="inline-flex items-center gap-2">
              <Share2 className="h-4 w-4" /> {shareCopied ? "Link Copied" : "Share"}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant={viewMode === "tree" ? "default" : "outline"}
                onClick={() => setViewMode("tree")}
                className="inline-flex items-center gap-2"
              >
                <TreePine className="h-4 w-4" /> Tree View
              </Button>
              <Button
                size="sm"
                variant={viewMode === "raw" ? "default" : "outline"}
                onClick={() => setViewMode("raw")}
                className="inline-flex items-center gap-2"
              >
                <Rows3 className="h-4 w-4" /> Raw JSON
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <Label htmlFor="json-input" className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <ClipboardPen className="h-3 w-3" /> JSON Input
              </Label>
              <Textarea
                id="json-input"
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                spellCheck={false}
                className="min-h-[280px] font-mono text-sm"
              />
            </div>
            <div className="space-y-4">
              <Label htmlFor="search" className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <Search className="h-3 w-3" /> Search JSON
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="search"
                  placeholder="Search keys or values…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={handleExpandAll} className="inline-flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" /> Expand
                </Button>
                <Button variant="outline" size="sm" onClick={handleCollapseAll} className="inline-flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" /> Collapse
                </Button>
              </div>
              {matches.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {currentMatchIndex + 1} / {matches.length} matches
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length)}
                    aria-label="Previous match"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentMatchIndex((prev) => (prev + 1) % matches.length)}
                    aria-label="Next match"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="rounded-xl border bg-card/80">
                {viewMode === "tree" ? (
                  renderTree()
                ) : (
                  <Textarea readOnly value={jsonText} spellCheck={false} className="min-h-[420px] font-mono text-sm" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Navigation</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb} className="flex items-center gap-2">
                <span className="rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                  {crumb}
                </span>
                {index < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
              </span>
            ))}
          </div>
          {copiedPath && (
            <p className="mt-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
              Copied path: {copiedPath}
            </p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Viewer Stats</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Nodes</dt>
              <dd className="font-semibold text-card-foreground">{parseResult.nodeCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Size</dt>
              <dd className="font-semibold text-card-foreground">{formatBytes(parseResult.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Parse Time</dt>
              <dd className="font-semibold text-card-foreground">{parseResult.parseTimeMs.toFixed(2)} ms</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Matches</dt>
              <dd className="font-semibold text-card-foreground">{matches.length}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
