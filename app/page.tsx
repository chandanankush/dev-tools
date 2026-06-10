/**
 * Home / gallery page — the site's entry point.
 *
 * This is a React Server Component (no "use client" directive), so it renders
 * to static HTML at build time. There is no per-request data fetching, which
 * means Next.js can fully pre-render and cache it as a static page.
 *
 * `toolSummaries` is a plain JS array derived from the tool registry at build
 * time; it carries only the display fields (title, description, slug, icon)
 * that ToolGallery needs — the heavy tool component code is never loaded on
 * this page, keeping the initial bundle small.
 *
 * Decorative background elements (dot-grid, gradient orb) are marked
 * `aria-hidden` and `pointer-events-none` so they don't affect accessibility
 * or user interaction.
 */
import Link from "next/link";
import { Terminal, Zap, Globe, Star, GitPullRequest, CircleDot } from "lucide-react";
import { serializeJsonLd } from "@/lib/seo";

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const LinkedinIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);
import { ToolGallery } from "@/components/ToolGallery";
import { toolSummaries } from "@/lib/tools.config";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Dev Toolkit",
  url: baseUrl,
  description:
    "Free browser-based developer tools: JSON formatter, UUID generator, JWT builder, QR code maker, regex tester, Base64 encoder, and more. No install required.",
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
      />
      <main className="relative isolate min-h-screen overflow-hidden">
        {/* Dot-grid background */}
        <div
          aria-hidden
          className="dot-grid-bg pointer-events-none absolute inset-0 -z-10"
        />
        {/* Gradient orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-48 -z-10 flex justify-center"
        >
          <div className="h-96 w-[64rem] rounded-full bg-gradient-to-r from-primary/20 via-sky-500/15 to-purple-500/20 blur-3xl" />
        </div>

        <div className="w-full space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-10 xl:px-16 2xl:px-20">
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
                  { icon: Terminal, label: "Next.js 16 RSC"  },
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

          {/* ── Gallery: receives the static summary list from the tool registry ── */}
          <ToolGallery tools={toolSummaries} />

          {/* ── Footer ── */}
          <footer className="border-t border-border/40 pt-10 pb-6">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
              {/* Headline */}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Open source &amp; community driven</p>
                <p className="text-xs text-muted-foreground">
                  Built with Next.js 16. Most tools run entirely client-side. The Short URL Expander uses a server-side proxy to follow redirects.
                </p>
              </div>

              {/* GitHub CTAs */}
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { href: "https://github.com/chandanankush/dev-tools", icon: Star,            label: "Star on GitHub"   },
                  { href: "https://github.com/chandanankush/dev-tools/fork", icon: GitPullRequest, label: "Contribute"        },
                  { href: "https://github.com/chandanankush/dev-tools/issues/new", icon: CircleDot,      label: "Raise an issue"   },
                  { href: "https://github.com/chandanankush/dev-tools", icon: GithubIcon,       label: "View source"      },
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
                <span className="text-[11px] text-muted-foreground">made by</span>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              <a
                href="https://www.linkedin.com/in/chandan-singh-mobileengineer/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
              >
                <LinkedinIcon />
                Chandan Singh — Mobile & Website Engineer
              </a>

              {/* Privacy Policy link — required by CLAUDE.md rule 12 for any public-facing site */}
              <Link
                href="/privacy"
                className="text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Privacy Policy
              </Link>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
