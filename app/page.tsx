import { Terminal, Zap, Globe, Github, Star, GitPullRequest, CircleDot, Linkedin } from "lucide-react";
import { ToolGallery } from "@/components/ToolGallery";
import { toolSummaries } from "@/lib/tools.config";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      {/* Dot-grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          opacity: 0.5,
        }}
      />
      {/* Gradient orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-48 -z-10 flex justify-center"
      >
        <div className="h-96 w-[64rem] rounded-full bg-gradient-to-r from-primary/20 via-sky-500/15 to-purple-500/20 blur-3xl" />
      </div>

      <div className="container space-y-8 py-10 sm:py-14">
        {/* ── Hero ── */}
        <header className="mx-auto flex flex-col items-center gap-4 text-center sm:max-w-3xl">
          {/* Terminal badge */}
          <div className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-card/80 px-4 py-1.5 font-mono text-xs text-muted-foreground shadow-sm backdrop-blur">
            <span className="text-emerald-500">$</span>
            <span>~/dev-toolkit</span>
            <span className="animate-pulse text-primary">▋</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Tools built for{" "}
              <span className="bg-gradient-to-r from-primary via-sky-500 to-purple-500 bg-clip-text text-transparent">
                developers
              </span>
            </h1>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {(
              [
                { icon: Zap,      label: "Zero install"    },
                { icon: Globe,    label: "Browser native"  },
                { icon: Terminal, label: "Next.js 15 RSC"  },
              ] as const
            ).map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3.5 py-1 text-xs text-muted-foreground backdrop-blur"
              >
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                {label}
              </span>
            ))}
          </div>

        </header>

        {/* ── Divider ── */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              browse tools
            </span>
          </div>
        </div>

        {/* ── Gallery ── */}
        <ToolGallery tools={toolSummaries} />

        {/* ── Footer ── */}
        <footer className="border-t border-border/40 pt-10 pb-6">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            {/* Headline */}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Open source &amp; community driven</p>
              <p className="text-xs text-muted-foreground">
                Built with Next.js 15. Most tools run entirely client-side. The Short URL Expander uses a server-side proxy to follow redirects.
              </p>
            </div>

            {/* GitHub CTAs */}
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { href: "https://github.com/chandanankush/dev-tools", icon: Star,            label: "Star on GitHub"   },
                { href: "https://github.com/chandanankush/dev-tools/fork", icon: GitPullRequest, label: "Contribute"        },
                { href: "https://github.com/chandanankush/dev-tools/issues/new", icon: CircleDot,      label: "Raise an issue"   },
                { href: "https://github.com/chandanankush/dev-tools", icon: Github,          label: "View source"      },
              ].map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </a>
              ))}
            </div>

            {/* Divider + author */}
            <div className="flex w-full items-center gap-4">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[11px] text-muted-foreground/60">made by</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            <a
              href="https://www.linkedin.com/in/chandan-singh-mobileengineer/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
            >
              <Linkedin className="h-4 w-4" aria-hidden />
              Chandan Singh — Mobile Engineer
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}

