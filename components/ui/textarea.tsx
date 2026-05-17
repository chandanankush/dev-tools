/**
 * Textarea — thin styled wrapper around a native <textarea>.
 *
 * Mirrors the Input component's design: all base styles are centralised here,
 * callers override via `className`. The `shadow-sm` on the textarea (but not
 * the single-line Input) visually distinguishes multiline text areas in dense
 * layouts. `forwardRef` lets parents attach a ref for programmatic focus or
 * measuring the element's height.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
