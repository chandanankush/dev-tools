/**
 * ToolCard — navigable card representing a single tool in the gallery grid.
 *
 * Each card renders a Lucide icon resolved from the tool's `icon` slug, the
 * tool's title and a two-line-clamped description, and a subtle arrow that
 * animates diagonally on hover to signal "opens a new page".
 *
 * Icon appearance is intentionally driven by semantic color tokens (e.g.
 * `text-primary`, `bg-secondary`) rather than raw palette values (e.g.
 * `text-blue-500`). This means the gallery automatically respects dark/light
 * theme switches and any future rebrand without touching this file.
 */
"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Binary,
  Braces,
  Calculator,
  Clock,
  Fingerprint,
  Globe,
  KeyRound,
  ListTree,
  Link2,
  QrCode,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Props sourced directly from the ToolSummary registry entry. */
interface ToolCardProps {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  /** Key into `iconConfig`; falls back to "default" (Sparkles) when absent or unrecognised. */
  icon?: string;
  tags?: string[];
  className?: string;
}

/**
 * Mapping from the string key stored in tools.config.ts to the Lucide icon
 * component and a pair of semantic Tailwind tokens — one for the icon glyph
 * colour and one for its circular badge background.
 *
 * Using a static record (rather than a dynamic import or switch) keeps the
 * bundle deterministic: tree-shaking removes icons not listed here, and there
 * is no runtime string→import resolution.
 *
 * The "default" entry acts as the guaranteed fallback so callers never need to
 * guard against undefined.
 */
const iconConfig: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  braces:      { icon: Braces,      color: "text-primary",            bg: "bg-primary/10"            },
  clock:       { icon: Clock,       color: "text-primary",            bg: "bg-primary/10"            },
  globe2:      { icon: Globe,       color: "text-secondary-foreground", bg: "bg-secondary"           },
  key:         { icon: KeyRound,    color: "text-secondary-foreground", bg: "bg-secondary"           },
  fingerprint: { icon: Fingerprint, color: "text-primary",            bg: "bg-primary/10"            },
  tree:        { icon: ListTree,    color: "text-secondary-foreground", bg: "bg-secondary"           },
  link:        { icon: Link2,       color: "text-muted-foreground",   bg: "bg-muted"                 },
  qrcode:      { icon: QrCode,      color: "text-muted-foreground",   bg: "bg-muted"                 },
  binary:      { icon: Binary,      color: "text-primary",            bg: "bg-primary/10"            },
  shield:      { icon: ShieldCheck, color: "text-secondary-foreground", bg: "bg-secondary"           },
  calculator:  { icon: Calculator,  color: "text-muted-foreground",   bg: "bg-muted"                 },
  // Sparkles is the catch-all for tools that haven't been assigned an icon yet.
  default:     { icon: Sparkles,    color: "text-primary",            bg: "bg-primary/10"            },
};

/**
 * Clickable card for a single tool entry.
 *
 * The entire surface is a Next.js `<Link>` so keyboard and pointer navigation
 * both work without extra event handling. Focus styles (`focus-visible:ring`)
 * are applied directly on the link rather than a wrapper so the visible ring
 * hugs the card boundary.
 */
export function ToolCard({ slug, title, description, icon, className }: ToolCardProps) {
  // `??` rather than `||` so an empty string still falls through to default.
  const cfg = icon ? (iconConfig[icon] ?? iconConfig.default) : iconConfig.default;
  const { icon: Icon, color, bg } = cfg;

  return (
    <Link
      href={`/tools/${slug}`}
      className={cn(
        "group flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm",
        // Border tint and a faint primary-coloured shadow on hover make the
        // card feel "lifted" without a heavy drop shadow at rest.
        "transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", bg)}>
          {/* aria-hidden: the card title already conveys what the icon depicts */}
          <Icon className={cn("h-5 w-5", color)} aria-hidden />
        </div>
        {/* Arrow nudges diagonally (↗) on hover to reinforce "go to this tool" */}
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/70 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      </div>

      <div className="space-y-1.5">
        <h3 className="font-semibold leading-tight text-card-foreground">{title}</h3>
        {/* line-clamp-2 keeps every card the same height regardless of description length */}
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>

    </Link>
  );
}
