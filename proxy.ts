/**
 * proxy.ts — Next.js 16 middleware (named "proxy" per Next.js 16 convention).
 *
 * Runs on every matched request (see `config.matcher`) to:
 *   1. Generate a per-request cryptographic nonce used in the Content-Security-Policy.
 *   2. Forward the nonce to the app via the `x-nonce` request header so the
 *      layout Server Component can apply it to <script> and <style> tags.
 *   3. Set the full suite of HTTP security headers on every response.
 *
 * CSP strategy:
 *   - `nonce-${nonce}` + `strict-dynamic` allows only scripts and styles that
 *     carry the nonce — inline or external scripts without the nonce are blocked.
 *   - Development adds `'unsafe-eval'` (needed for Next.js HMR) and allows
 *     WebSocket connections for hot reload. Neither directive is present in
 *     production.
 *   - `img-src 'self' data:` allows base64 data URIs (used by QR code preview)
 *     without allowing arbitrary external images.
 *
 * The matcher regex excludes static assets (_next/static, images, fonts, etc.)
 * so the middleware does not add overhead to those responses.
 *
 * Security header reference: see CLAUDE.md rule 6 for the full required set and
 * acceptable values. Do not remove any header; fix the tool instead.
 */

import { NextRequest, NextResponse } from "next/server";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function proxy(request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const nonce = generateNonce();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const csp = [
    "default-src 'self'",
    isDevelopment
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
      : `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    isDevelopment ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    !isDevelopment ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2|ttf|otf)$).*)",
  ],
};
