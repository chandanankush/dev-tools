"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { ToolSummary } from "@/lib/tools.config";
import { searchTools } from "@/lib/search";
import { ToolCard } from "./ToolCard";

interface ToolGalleryProps {
  tools: ToolSummary[];
}

export function ToolGallery({ tools }: ToolGalleryProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => searchTools(query, tools), [query, tools]);
  const toolCount = filtered.length;

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Find your tool
            </p>
            <h2 className="text-xl font-semibold text-card-foreground sm:text-2xl">
              {query ? `Showing ${toolCount} match${toolCount === 1 ? "" : "es"}` : "Browse all tools"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Search by name or tags to locate the utility you need in seconds.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools..."
              aria-label="Search tools"
              className="pl-10"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tool) => (
          <ToolCard
            key={tool.slug}
            slug={tool.slug}
            title={tool.title}
            description={tool.description}
            thumbnail={tool.thumbnail}
            icon={tool.icon}
          />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed bg-muted/40 p-8 text-center text-sm text-muted-foreground">
            No tools match your search yet. Try a different keyword.
          </p>
        )}
      </div>
    </section>
  );
}
