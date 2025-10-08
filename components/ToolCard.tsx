/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-img-element */
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
  className?: string;
}

const iconLibrary: Record<string, LucideIcon> = {
  braces: Braces,
  fingerprint: Fingerprint,
  tree: ListTree,
  link: Link2,
  qrcode: QrCode,
  binary: Binary,
  shield: ShieldCheck,
  default: Sparkles,
};

export function ToolCard({
  slug,
  title,
  description,
  thumbnail,
  icon,
  className,
}: ToolCardProps) {
  const Icon = icon ? iconLibrary[icon] ?? iconLibrary.default : null;

  return (
    <Link
      href={`/tools/${slug}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm transition hover:border-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="relative aspect-[11/5] w-full overflow-hidden bg-muted">
        <img
          src={thumbnail}
          alt={`${title} thumbnail`}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
        {Icon ? (
          <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow ring-1 ring-primary/30">
            <Icon className="h-3 w-3" aria-hidden />
          </div>
        ) : null}
        <div className="absolute inset-x-2 bottom-2 flex items-start justify-between gap-2 rounded-md bg-background/85 px-2.5 py-2 text-left shadow-sm backdrop-blur">
          <div className="flex-1 space-y-1">
            <h3 className="truncate text-[13px] font-semibold leading-tight text-card-foreground">{title}</h3>
            <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{description}</p>
          </div>
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
        </div>
      </div>
    </Link>
  );
}
