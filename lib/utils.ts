/**
 * Tailwind class merging utility.
 *
 * `cn` pipes values through clsx (handles arrays, objects, conditionals) then
 * through tailwind-merge, which resolves Tailwind class conflicts — e.g.
 * `cn("p-4", "p-6")` returns "p-6" instead of both classes, which would
 * produce unpredictable results because CSS specificity doesn't guarantee
 * source-order precedence in all browsers.
 *
 * Used throughout the codebase wherever className props need to be merged with
 * conditional or overriding classes.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes, resolving conflicts so the last value wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
