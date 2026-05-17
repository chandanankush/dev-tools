/**
 * UTF-8–safe Base64 encode/decode utilities.
 *
 * The browser built-ins `btoa` and `atob` operate on "binary strings" — they
 * treat each character as a single byte. Any input containing characters
 * outside the Latin-1 range (U+0100 and above, including most emoji and
 * non-Latin scripts) will throw a `InvalidCharacterError` from `btoa` because
 * those code points do not fit in one byte.
 *
 * This module solves the problem with a two-pass approach:
 *   1. `TextEncoder.encode(input)` converts the JS string to a UTF-8
 *      `Uint8Array`. Every character, regardless of its Unicode code point,
 *      is correctly represented as 1–4 bytes.
 *   2. The resulting byte array is then converted to a Base64 string.
 *      In Node.js (SSR) we delegate to `Buffer.from(bytes).toString("base64")`
 *      which is natively efficient. In the browser we build an ASCII binary
 *      string character-by-character and then call `btoa`, which is safe
 *      because we are now feeding it raw bytes, not a multi-byte JS string.
 *
 * Decoding is the mirror image: Base64 → bytes → `TextDecoder.decode(bytes)`.
 *
 * Module-level encoder/decoder instances are reused across calls to avoid the
 * overhead of constructing a new object on every invocation.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Converts a raw byte array to a standard Base64 string.
 * Prefers the Node.js `Buffer` path when available (faster for large inputs).
 */
function encodeBytes(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  // Browser path: build a binary string first so btoa receives only
  // single-byte characters (0x00–0xFF), avoiding InvalidCharacterError.
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

/**
 * Converts a Base64 string back to a raw byte array.
 * Strips whitespace first so copy-pasted Base64 with line breaks is handled
 * gracefully without a separate sanitisation step at the call site.
 */
function decodeToBytes(base64: string) {
  // Whitespace (newlines, spaces) is common in PEM-formatted Base64 and
  // copy-pasted values — strip it before passing to Buffer/atob.
  const sanitized = base64.replace(/\s+/g, "");

  if (typeof Buffer !== "undefined") {
    const buffer = Buffer.from(sanitized, "base64");
    // Slice the underlying ArrayBuffer to the buffer's logical range;
    // Buffer.from may return a view into a larger shared pool.
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
  }

  const binary = atob(sanitized);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Encodes a Unicode string to Base64 via UTF-8 byte representation.
 * Safe for any input including emoji and non-Latin characters.
 */
export function encodeBase64(input: string) {
  const bytes = textEncoder.encode(input);
  return encodeBytes(bytes);
}

/**
 * Decodes a Base64 string back to a Unicode string.
 * Throws a descriptive Error (rather than a raw DOMException) when the input
 * is not valid Base64, so callers can display the message directly to users.
 */
export function decodeBase64(input: string) {
  try {
    const bytes = decodeToBytes(input);
    return textDecoder.decode(bytes);
  } catch (error) {
    throw new Error((error as Error).message || "Failed to decode Base64.");
  }
}
