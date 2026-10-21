/**
 * Visitor counter API.
 *
 *   GET  /api/visits → { count }
 *   POST /api/visits → increments, then { count }
 *
 * The client calls POST once per browser (it remembers that in localStorage) and
 * GET on every later visit. POST is a cheap, best-effort guard against casual
 * inflation, not authentication: it must come from this site (Sec-Fetch-Site /
 * Origin) and is rate-limited per IP and overall (see lib/visit-rate-limit.ts for the
 * limits and why the overall cap is the real backstop). Keep the origin behind
 * Cloudflare / the reverse proxy rather than exposing the port directly.
 *
 * This route makes no outbound requests and accepts no user input beyond headers.
 */
import { NextResponse } from "next/server";
import { getCount, incrementCount } from "@/lib/visit-counter";
import { WINDOW_MS, isRateLimited } from "@/lib/visit-rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    // rightmost hop is the address our own proxy saw; the leftmost is client-supplied
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    "unknown"
  );
}

function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({ count: await getCount() }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: NO_STORE });
  }

  if (isRateLimited(clientIp(request), Date.now())) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(WINDOW_MS / 1000) } },
    );
  }

  try {
    return NextResponse.json({ count: await incrementCount() }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Unable to record visit." }, { status: 500, headers: NO_STORE });
  }
}
