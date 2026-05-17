/**
 * ToolGallery — interactive search-and-filter grid for the homepage.
 *
 * Filtering pipeline (applied in order each render):
 *   1. Full-text fuzzy search via Fuse.js (`searchTools`) — matches title and
 *      tags with a 0.35 threshold; returns all tools when the query is blank.
 *   2. Tag filter — if `activeTag` is set, the fuzzy results are narrowed to
 *      tools that carry that exact tag.
 *
 * Both steps run inside a single `useMemo` so only one pass through the data
 * occurs per render. Tag derivation is also memoised because it only changes
 * when the `tools` prop changes (i.e. never at runtime — the prop is static).
 *
 * Keyboard shortcut: pressing "/" anywhere on the page (except when an input
 * or textarea already has focus) moves focus to the search box and shows the
 * tag dropdown. A "/" hint badge is shown inside the empty search box on
 * sm+ viewports as a visible affordance.
 */
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { ToolSummary } from "@/lib/tools.config";
import { searchTools } from "@/lib/search";
import { ToolCard } from "./ToolCard";

/** Accepts the full list of tools from the server component; all filtering is client-side. */
interface ToolGalleryProps {
  tools: ToolSummary[];
}

export function ToolGallery({ tools }: ToolGalleryProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Holds the pending hide-tags timer so it can be cancelled if the input
  // regains focus before the timeout fires (e.g. clicking a tag chip).
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collect every unique tag from all tools, sorted alphabetically, once.
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tools.forEach((tool) => tool.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tools]);

  // Tags to show: filtered by query when typing, all tags when focused with no query
  const suggestedTags = useMemo(() => {
    if (!query) return allTags;
    const q = query.toLowerCase();
    return allTags.filter((tag) => tag.toLowerCase().includes(q));
  }, [allTags, query]);

  // Press "/" to focus search — only fires when no text input already has focus
  // so users typing in a tool's own inputs aren't hijacked.
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

  // Run fuzzy search first, then layer the tag filter on top of those results.
  const filtered = useMemo(() => {
    let results = searchTools(query, tools);
    if (activeTag) {
      results = results.filter((tool) => tool.tags.includes(activeTag));
    }
    return results;
  }, [query, tools, activeTag]);

  const handleFocus = () => {
    // Cancel any pending hide so quickly re-focusing doesn't flicker the tag row.
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setShowTags(true);
  };

  const handleBlur = () => {
    // 150 ms grace period: if the user clicks a tag chip the mousedown fires
    // before the blur, but the click fires ~50 ms after. The delay ensures the
    // click handler runs before we hide the tag row, preventing a "missed click".
    blurTimerRef.current = setTimeout(() => setShowTags(false), 150);
  };

  const handleTagClick = (tag: string) => {
    // Toggle: clicking the active tag deselects it.
    setActiveTag(activeTag === tag ? null : tag);
    // Return focus to the search input so the tag row stays visible and
    // keyboard users can continue typing without a second Tab press.
    inputRef.current?.focus();
  };

  // Keep the tag row visible as long as the input is focused OR a tag is pinned,
  // so the active-tag chip is always accessible for removal.
  const tagsVisible = showTags || activeTag !== null;

  return (
    <section className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
          // "/" hint — hidden on mobile to avoid cluttering a narrow input.
          <kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 hidden select-none rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            /
          </kbd>
        )}
      </div>

      {/* Tag suggestions — visible only when search is focused or a tag is active */}
      {tagsVisible && (
        <div className="flex flex-wrap gap-1.5">
          {activeTag && (
            // Active tag rendered first, styled distinctly so users know it's
            // filtering the results. onMouseDown preventDefault stops the input
            // blur from firing before the onClick removes the tag.
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveTag(null)}
              className="rounded-md border border-primary bg-primary/10 px-3 py-1 font-mono text-xs text-primary transition-colors hover:bg-primary/20"
            >
              {activeTag} ×
            </button>
          )}
          {suggestedTags
            .filter((tag) => tag !== activeTag)
            .map((tag) => (
              <button
                key={tag}
                // preventDefault on mousedown for the same blur-timing reason as above.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleTagClick(tag)}
                className="rounded-md border border-border px-3 py-1 font-mono text-xs text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                {tag}
              </button>
            ))}
          {suggestedTags.length === 0 && (
            <span className="font-mono text-xs text-muted-foreground">No matching tags</span>
          )}
        </div>
      )}

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
          <div className="col-span-full rounded-xl border border-dashed bg-muted/50 p-12 text-center">
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
