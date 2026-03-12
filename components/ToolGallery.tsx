"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { ToolSummary } from "@/lib/tools.config";
import { searchTools } from "@/lib/search";
import { ToolCard } from "./ToolCard";
import { cn } from "@/lib/utils";

interface ToolGalleryProps {
  tools: ToolSummary[];
}

export function ToolGallery({ tools }: ToolGalleryProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tools.forEach((tool) => tool.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tools]);

  // Press "/" to focus search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    let results = searchTools(query, tools);
    if (activeTag) {
      results = results.filter((tool) => tool.tags.includes(activeTag));
    }
    return results;
  }, [query, tools, activeTag]);

  return (
    <section className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          aria-label="Search tools"
          className="h-11 pl-10 pr-16 text-sm"
        />
        {query ? (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 hidden select-none rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            /
          </kbd>
        )}
      </div>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveTag(null)}
          className={cn(
            "rounded-md border px-3 py-1 font-mono text-xs transition-colors",
            activeTag === null
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          all
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={cn(
              "rounded-md border px-3 py-1 font-mono text-xs transition-colors",
              activeTag === tag
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Result count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "tool" : "tools"}
        {activeTag ? ` tagged "${activeTag}"` : ""}
        {query ? ` matching "${query}"` : ""}
      </p>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((tool) => (
          <ToolCard
            key={tool.slug}
            slug={tool.slug}
            title={tool.title}
            description={tool.description}
            thumbnail={tool.thumbnail}
            icon={tool.icon}
            tags={tool.tags}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed bg-muted/30 p-12 text-center">
            <p className="text-sm text-muted-foreground">No tools match your search.</p>
            <button
              onClick={() => { setQuery(""); setActiveTag(null); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
