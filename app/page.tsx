import { ToolGallery } from "@/components/ToolGallery";
import { toolSummaries } from "@/lib/tools.config";

const totalTools = toolSummaries.length;
const totalTags = new Set(toolSummaries.flatMap((tool) => tool.tags)).size;

export default function HomePage() {
  return (
    <main className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-32 -z-10 blur-2xl">
        <div className="mx-auto h-48 w-[48rem] bg-gradient-to-r from-primary/25 via-sky-500/20 to-purple-500/25 opacity-60" />
      </div>
      <div className="container space-y-10 py-12 sm:space-y-12 sm:py-16">
        <header className="mx-auto flex flex-col items-center gap-6 text-center sm:max-w-3xl sm:gap-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Developer Utilities
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
              {totalTools}+ tools
            </span>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Supercharge your workflow in the browser.
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
              Explore a curated collection of developer-first utilities built with Next.js 15. Every
              tool launches instantly, works offline, and is simple to extend with your own ideas.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
              <p className="text-2xl font-semibold text-card-foreground">{totalTools}</p>
              <p className="text-xs text-muted-foreground">Curated utilities</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
              <p className="text-2xl font-semibold text-card-foreground">{totalTags}</p>
              <p className="text-xs text-muted-foreground">Unique tags for filtering</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
              <p className="text-2xl font-semibold text-card-foreground">RSC</p>
              <p className="text-xs text-muted-foreground">Optimized with App Router</p>
            </div>
          </div>
        </header>
        <ToolGallery tools={toolSummaries} />
      </div>
    </main>
  );
}
