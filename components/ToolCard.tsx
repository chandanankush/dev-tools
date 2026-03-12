"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Binary,
  Braces,
  Fingerprint,
  ListTree,
  Link2,
  QrCode,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  icon?: string;
  tags?: string[];
  className?: string;
}

const iconConfig: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  braces:      { icon: Braces,      color: "text-blue-500",    bg: "bg-blue-500/10"    },
  fingerprint: { icon: Fingerprint, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  tree:        { icon: ListTree,    color: "text-indigo-500",  bg: "bg-indigo-500/10"  },
  link:        { icon: Link2,       color: "text-amber-500",   bg: "bg-amber-500/10"   },
  qrcode:      { icon: QrCode,      color: "text-cyan-500",    bg: "bg-cyan-500/10"    },
  binary:      { icon: Binary,      color: "text-pink-500",    bg: "bg-pink-500/10"    },
  shield:      { icon: ShieldCheck, color: "text-orange-500",  bg: "bg-orange-500/10"  },
  default:     { icon: Sparkles,    color: "text-primary",     bg: "bg-primary/10"     },
};

export function ToolCard({ slug, title, description, icon, tags, className }: ToolCardProps) {
  const cfg = icon ? (iconConfig[icon] ?? iconConfig.default) : iconConfig.default;
  const { icon: Icon, color, bg } = cfg;

  return (
    <Link
      href={`/tools/${slug}`}
      className={cn(
        "group flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm",
        "transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", bg)}>
          <Icon className={cn("h-5 w-5", color)} aria-hidden />
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      </div>

      <div className="space-y-1.5">
        <h3 className="font-semibold leading-tight text-card-foreground">{title}</h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>

      {tags && tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
