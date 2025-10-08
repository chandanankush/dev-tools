import { ToolGallery } from "@/components/ToolGallery";
import { toolSummaries } from "@/lib/tools.config";

const totalTools = toolSummaries.length;
const totalTags = new Set(toolSummaries.flatMap((tool) => tool.tags)).size;

export default function HomePage() {
  return (
    <main className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-28 -z-10 blur-2xl">
        <div className="mx-auto h-40 w-[44rem] bg-gradient-to-r from-primary/25 via-sky-500/20 to-purple-500/25 opacity-60" />
      </div>
      <div className="container space-y-8 py-10 sm:space-y-10 sm:py-12">
        <header className="mx-auto flex flex-col items-center gap-5 text-center sm:max-w-3xl sm:gap-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Developer Utilities
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
              {totalTools}+ tools
            </span>
          </div>
          <div className="space-y-2.5 sm:space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Supercharge your workflow in the browser.
            </h1>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
              Explore a curated collection of developer-first utilities built with Next.js 15. Every
              tool launches instantly, works offline, and is simple to extend with your own ideas.
            </p>
          </div>
          <div className="grid w-full gap-2.5 sm:grid-cols-3 sm:gap-3">
            <div className="rounded-xl border border-border/60 bg-card/80 p-3.5 shadow-sm">
              <p className="text-xl font-semibold text-card-foreground">{totalTools}</p>
              <p className="text-[11px] text-muted-foreground">Curated utilities</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-3.5 shadow-sm">
              <p className="text-xl font-semibold text-card-foreground">{totalTags}</p>
              <p className="text-[11px] text-muted-foreground">Unique tags for filtering</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-3.5 shadow-sm">
              <p className="text-xl font-semibold text-card-foreground">RSC</p>
              <p className="text-[11px] text-muted-foreground">Optimized with App Router</p>
            </div>
          </div>
        </header>
        <ToolGallery tools={toolSummaries} />
      </div>
    </main>
  );
}
