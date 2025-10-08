/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Braces,
  Fingerprint,
  ListTree,
  Link2,
  QrCode,
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
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm transition hover:border-border hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={thumbnail}
          alt={`${title} thumbnail`}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {Icon ? (
          <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/30">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold leading-tight text-card-foreground">{title}</h3>
          <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
