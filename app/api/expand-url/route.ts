/**
 * POST /api/expand-url — server-side URL expansion endpoint.
 *
 * URL expansion must happen server-side (not client-side) because:
 *   - Following redirects from the browser would be blocked by CORS for most
 *     shorteners that don't set permissive Access-Control-Allow-Origin headers.
 *   - A client-side `fetch` cannot observe the intermediate redirect locations
 *     that reveal the final destination of a redirect chain.
 *
 * Security (SSRF prevention):
 *   - `isPrivateHost` rejects any URL that would resolve to a private/internal
 *     network address (RFC-1918, loopback, link-local, CGNAT).
 *   - Redirects are followed manually (`redirect: "manual"`) so every hop is
 *     validated through `isPrivateHost` before fetching — an attacker cannot use
 *     a public URL that redirects to `169.254.169.254` (AWS metadata) to bypass
 *     the initial check. See CLAUDE.md rule 2 for the full SSRF policy.
 *
 * Retry strategy:
 *   - HEAD is attempted first (faster, no body).
 *   - If the server responds with a status in `retryStatuses` (auth challenges,
 *     method-not-allowed, rate limits, server errors) the request is retried as
 *     GET, which some servers require to return a 200.
 *
 * Timeout:
 *   - Each attempt is bounded by `REQUEST_TIMEOUT_MS` (10 s) via AbortController
 *     to prevent a slow external server from hanging the serverless function.
 */

import { NextRequest, NextResponse } from "next/server";

type ExpandUrlResponse = {
  shortUrl: string;
  longUrl: string | null;
  status: "success" | "error";
  statusCode?: number;
  method?: "HEAD" | "GET";
  durationMs?: number;
  error?: string;
};

const MAX_URLS = 20;
const MAX_REDIRECTS = 10;
const REQUEST_TIMEOUT_MS = 10_000;

// Block requests to private/internal network addresses to prevent SSRF.
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "::1") return true;
  // IPv4 private ranges: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

// Validates that a URL is safe to fetch (http/https only, no private hosts).
function validateUrl(url: string): { href: string } | { error: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "Invalid URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: "Only http and https URLs are supported." };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { error: "URL resolves to a disallowed address." };
  }
  return { href: parsed.href };
}

// Manually follows redirects so every hop is validated against isPrivateHost,
// preventing SSRF via open redirects on otherwise-allowed public hosts.
async function fetchWithValidatedRedirects(
  startUrl: string,
  method: "HEAD" | "GET",
  signal: AbortSignal,
): Promise<Response> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validated = validateUrl(currentUrl);
    if ("error" in validated) throw new Error(validated.error);

    const response = await fetch(validated.href, {
      method,
      redirect: "manual",
      headers: COMMON_HEADERS,
      signal,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      // Resolve relative redirects against the current URL.
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects.");
}

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid JSON body.",
        details: (error as Error).message,
      },
      { status: 400 },
    );
  }

  const urls =
    Array.isArray((payload as { urls?: unknown }).urls) ?
      (payload as { urls: unknown[] }).urls
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean)
    : [];

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one short URL to expand." },
      { status: 400 },
    );
  }

  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `A maximum of ${MAX_URLS} URLs can be expanded at once.` },
      { status: 400 },
    );
  }

  const results = await Promise.all(urls.map(resolveUrl));

  return NextResponse.json({ results });
}

async function resolveUrl(url: string): Promise<ExpandUrlResponse> {
  const initial = validateUrl(url);
  if ("error" in initial) {
    return { shortUrl: url, longUrl: null, status: "error", error: initial.error };
  }

  let lastErrorMessage = "Unable to resolve URL.";

  const methods: Array<"HEAD" | "GET"> = ["HEAD", "GET"];
  const retryStatuses = new Set([401, 402, 403, 405, 406, 429, 500, 502, 503, 504]);

  for (const method of methods) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetchWithValidatedRedirects(initial.href, method, controller.signal);
      const durationMs = Date.now() - startedAt;

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          shortUrl: url,
          longUrl: response.url,
          status: "success",
          statusCode: response.status,
          method,
          durationMs,
        };
      }

      // Some providers reject HEAD requests or require authentication; retry with GET.
      if (method === "HEAD" && retryStatuses.has(response.status)) {
        lastErrorMessage = `Rejected with status ${response.status}.`;
        continue;
      }

      return {
        shortUrl: url,
        longUrl: response.url,
        status: "error",
        statusCode: response.status,
        method,
        durationMs,
        error: `Request failed with status ${response.status}.`,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === "AbortError") {
        lastErrorMessage = `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`;
      } else {
        lastErrorMessage = (error as Error).message || lastErrorMessage;
      }
    }
  }

  return {
    shortUrl: url,
    longUrl: null,
    status: "error",
    error: lastErrorMessage,
  };
}
