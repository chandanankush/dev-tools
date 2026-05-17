/**
 * Browser-side JWT creation and decoding using the Web Crypto API.
 *
 * Why browser-side signing?
 * The JWT Generator tool is a developer utility: users paste their own HMAC
 * secret to craft tokens for testing. Running the operation entirely in the
 * browser means the secret never leaves the user's machine — there is no
 * server route that could log or leak it. The Web Crypto API (`crypto.subtle`)
 * is available in all modern browsers and in the Node.js runtime used for SSR,
 * so the same code path works in both environments.
 *
 * Algorithm: HS256 (HMAC-SHA-256)
 * The header is always `{"alg":"HS256","typ":"JWT"}`. The signature covers
 * `base64url(header) + "." + base64url(payload)` as specified in RFC 7519.
 *
 * Base64url vs standard Base64:
 * JWT requires the "URL-safe" Base64 alphabet: `+` → `-`, `/` → `_`, and
 * padding (`=`) is stripped. This avoids encoding issues when tokens appear
 * in HTTP headers or query strings.
 */

const encoder = new TextEncoder();

/** Converts a JS string to its UTF-8 byte representation. */
function utf8Bytes(input: string) {
  return encoder.encode(input);
}

/**
 * Encodes a byte array as a Base64url string (no padding, URL-safe alphabet).
 * Uses the Node.js `Buffer` path on the server and the `btoa` path in the
 * browser — both produce identical output after the alphabet substitution.
 */
function base64UrlEncode(bytes: Uint8Array) {
  let base64: string;
  if (typeof window === "undefined") {
    // Server / Node.js path.
    base64 = Buffer.from(bytes).toString("base64");
  } else {
    // Browser path: build a binary string so btoa receives only Latin-1 chars.
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    base64 = btoa(binary);
  }

  // Convert standard Base64 alphabet to the URL-safe Base64url alphabet and
  // strip trailing `=` padding — both transformations are required by the JWT spec.
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Produces an HMAC-SHA-256 signature over `message` using `secret`.
 * `crypto.subtle.importKey` with `extractable: false` ensures the key material
 * cannot be read back out of the Web Crypto subsystem after import.
 */
async function hmacSHA256(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", utf8Bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  const signature = await crypto.subtle.sign("HMAC", key, utf8Bytes(message));
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Decodes a Base64url string back to a byte array.
 * Re-adds the `=` padding that was stripped during encoding; without it,
 * `atob` / `Buffer.from` would throw on inputs whose length is not a
 * multiple of 4.
 */
function base64UrlDecode(base64Url: string) {
  // Restore standard Base64 alphabet and padding before decoding.
  const paddingNeeded = base64Url.length % 4;
  const normalized = (paddingNeeded ? base64Url + "=".repeat(4 - paddingNeeded) : base64Url)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  if (typeof window === "undefined") {
    const buffer = Buffer.from(normalized, "base64");
    // Slice to the buffer's logical range in case it's a view into a pool.
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
  }

  const binary = atob(normalized);
  const len = binary.length;
  const bytes = new Uint8Array(len);

  for (let index = 0; index < len; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/**
 * Input shape for the JWT Generator tool.
 * All fields map directly to well-known JWT claim names or vendor-specific
 * claims used by the "bos" issuer convention on this platform.
 */
export type JwtPayloadInput = {
  /** Identifies the calling application; becomes the `clientId` claim. */
  clientID: string;
  /** HMAC secret used to sign the token. Never sent to the server. */
  secret: string;
  /** Optional vendor-specific claim; omitted from the payload when blank. */
  workflowName?: string;
  /** Optional vendor-specific claim; omitted from the payload when blank. */
  workflowId?: string;
  /** Optional vendor-specific claim; omitted from the payload when blank. */
  authCode?: string;
};

/**
 * Creates a signed HS256 JWT from the provided inputs.
 * Optional fields are included in the payload only when non-empty, keeping
 * the token compact when callers do not need those claims.
 *
 * @returns A compact serialisation string in the format `header.payload.signature`.
 */
export async function createHs256Token({ clientID, secret, workflowName, workflowId, authCode }: JwtPayloadInput) {
  const header = base64UrlEncode(utf8Bytes(JSON.stringify({ alg: "HS256", typ: "JWT" })));

  const payloadObject: Record<string, unknown> = {
    clientId: clientID,
    iss: "bos",
  };

  if (workflowName) payloadObject.workflowName = workflowName;
  if (workflowId) payloadObject.workflowId = workflowId;
  if (authCode) payloadObject.auth_code = authCode;

  const payload = base64UrlEncode(utf8Bytes(JSON.stringify(payloadObject)));

  // The signature input is the ASCII string "header.payload" as specified by
  // RFC 7519 §6 — not the decoded bytes of header or payload.
  const signature = await hmacSHA256(`${header}.${payload}`, secret);

  return `${header}.${payload}.${signature}`;
}

/**
 * Decodes (but does not verify) a JWT compact serialisation.
 * Useful for inspecting the header and payload claims of any token regardless
 * of algorithm; skips signature verification because the secret is not known
 * to this function.
 *
 * @throws Error when the input has fewer than two dot-separated segments (not
 *   a structurally valid JWT).
 */
export function decodeJwt(token: string) {
  const segments = token.split(".");

  if (segments.length < 2) {
    throw new Error("Invalid JWT: tokens require at least header and payload.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;

  const decodedHeader = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)));
  const decodedPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));

  return {
    header: decodedHeader,
    payload: decodedPayload,
    // The signature segment is absent on unsigned ("alg":"none") tokens.
    signature: encodedSignature ?? null,
    hasSignature: Boolean(encodedSignature),
  };
}
