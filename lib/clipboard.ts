export async function copyToClipboard(value: string): Promise<void> {
  if (!value) return;
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API is unavailable in this browser.");
  }
  await navigator.clipboard.writeText(value);
}
