"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ToolShellProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function ToolShell({ title, description, children, className }: ToolShellProps) {
  return (
    <div className={cn("space-y-8", className)}>
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tools
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
