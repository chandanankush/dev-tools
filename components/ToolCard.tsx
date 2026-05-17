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
  default:     { icon: Sparkles,    color: "text-primary",            bg: "bg-primary/10"            },
};

export function ToolCard({ slug, title, description, icon, className }: ToolCardProps) {
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
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/70 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      </div>

      <div className="space-y-1.5">
        <h3 className="font-semibold leading-tight text-card-foreground">{title}</h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>

    </Link>
  );
}
