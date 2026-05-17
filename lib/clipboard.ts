/**
 * Shared clipboard utility used by all tool components.
 *
 * Extracted here (rather than inline in each component) so that:
 * - The navigator.clipboard availability guard lives in one place.
 * - Components receive a typed Promise<void> they can await/catch without
 *   duplicating the try/catch or the SSR guard.
 *
 * The empty-string early return lets callers skip the guard check — passing
 * an empty output value is a no-op rather than an unnecessary API call.
 */

/**
 * Writes `value` to the system clipboard.
 * Throws when the Clipboard API is unavailable (non-HTTPS, SSR, or blocked
 * by browser permissions) so callers can surface a meaningful error message
 * rather than silently failing.
 */
export async function copyToClipboard(value: string): Promise<void> {
  if (!value) return;
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API is unavailable in this browser.");
  }
  await navigator.clipboard.writeText(value);
}
