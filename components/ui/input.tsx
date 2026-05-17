/**
 * Input — thin styled wrapper around a native <input>.
 *
 * Keeps all base styles (border, ring, height, text size) in one place so
 * every input in the app looks identical without repeating Tailwind class
 * strings. Callers override via `className` — tailwind-merge ensures conflicts
 * resolve in favour of the caller's value.
 *
 * `forwardRef` is required so parent components (e.g. form libraries or
 * components that need to programmatically focus the field) can attach a ref.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
