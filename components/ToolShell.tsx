/**
 * ToolShell — shared layout wrapper for every individual tool page.
 *
 * Every tool page has the same structural skeleton:
 *   - A "Back to tools" breadcrumb link at the top
 *   - An H1 title and subtitle description
 *   - A card-styled content area that hosts the tool's own interactive UI
 *
 * Centralising this structure here ensures visual consistency across all tools
 * and means a change to the breadcrumb copy, spacing, or card style propagates
 * everywhere automatically. Tool pages only need to supply title, description,
 * and their own UI as `children`.
 */
"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** All props are required except `className`, which allows per-page spacing overrides. */
interface ToolShellProps {
  title: string;
  description: string;
  children: ReactNode;
  /** Optional extra Tailwind classes on the outermost container — useful when a
   *  tool page needs more vertical breathing room than the default `space-y-8`. */
  className?: string;
  /** When set, the shell fills the viewport (100dvh) with a compact,
   *  mobile-collapsed header and a flex-grow card, so canvas tools like
   *  Brainstorm can take almost the whole screen. See ToolMeta.fullBleed. */
  fullBleed?: boolean;
}

/**
 * Consistent chrome (breadcrumb + heading + card) for a tool detail page.
 *
 * The breadcrumb always points to "/" (the gallery) — there are no nested
 * tool categories, so a single "back" level is sufficient.
 *
 * The content card uses `bg-card` rather than `bg-background` so it remains
 * visually distinct from the page background in both light and dark themes.
 */
export function ToolShell({ title, description, children, className, fullBleed }: ToolShellProps) {
  return (
    <div
      className={cn(
        fullBleed ? "flex h-[100dvh] flex-col gap-3 p-2 sm:gap-4 sm:p-4" : "space-y-8",
        className
      )}
    >
      <div className={cn("space-y-4", fullBleed && "shrink-0 space-y-2")}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tools
        </Link>
        <div>
          <h1 className={cn("font-bold tracking-tight", fullBleed ? "text-xl sm:text-4xl" : "text-3xl sm:text-4xl")}>{title}</h1>
          {/* max-w-2xl prevents the description from becoming an uncomfortably
              long measure on wide viewports. In full-bleed mode it is hidden on
              mobile to reclaim vertical space for the tool. */}
          <p className={cn("mt-2 max-w-2xl text-muted-foreground", fullBleed && "hidden sm:block")}>{description}</p>
        </div>
      </div>
      <div className={cn("rounded-xl border bg-card shadow-sm", fullBleed ? "flex min-h-0 flex-1 flex-col p-2 sm:p-6" : "p-6")}>
        {children}
      </div>
    </div>
  );
}
