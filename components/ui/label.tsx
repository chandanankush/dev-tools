/**
 * Label — styled wrapper around Radix UI's Label primitive.
 *
 * Radix's LabelPrimitive.Root wires the label to its associated form control
 * via `htmlFor` and also prevents the default text-selection behaviour on
 * double-click (which would otherwise select the label text instead of
 * activating the control). The `peer-disabled` Tailwind variants visually dim
 * the label when its paired input is disabled.
 */

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
