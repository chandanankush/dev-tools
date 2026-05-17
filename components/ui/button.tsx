/**
 * Button — the primary interactive element used across all tool UIs.
 *
 * Design decisions:
 * - `asChild` (Radix Slot pattern) lets any element inherit Button styles
 *   without nesting a <button> inside an <a> or <Link>, which would be invalid
 *   HTML. Pass `asChild` and make the first child the actual element.
 * - Variant and size styles are kept in static record objects (`variantClasses`,
 *   `sizeClasses`) so they are easy to scan and extend without logic branches.
 * - All variants set `focus-visible:ring` for accessible keyboard navigation.
 * - `disabled:pointer-events-none` on the base class prevents click handlers
 *   from firing even when `onClick` is set without checking `disabled` manually.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-primary text-primary-foreground shadow transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  secondary:
    "bg-secondary text-secondary-foreground transition hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  outline:
    "border border-input bg-background text-foreground transition hover:bg-accent hover:text-accent-foreground",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-10 px-4 py-2 text-sm",
  sm: "h-9 px-3 py-1.5 text-xs",
  icon: "h-9 w-9 p-0",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
