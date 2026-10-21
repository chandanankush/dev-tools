/**
 * Visitor counter API.
 *
 *   GET  /api/visits → { count }
 *   POST /api/visits → increments, then { count }
 *
 * The client calls POST once per browser (it remembers that in localStorage) and
 * GET on every later visit. POST is a cheap, best-effort guard against casual
 * inflation, not authentication: it must come from this site (Sec-Fetch-Site /
 * Origin) and is rate-limited per IP. The IP is held in memory only, for the
 * length of the window, and never written anywhere.
 *
 * This route makes no outbound requests and accepts no user input beyond headers.
 */
import { NextResponse } from "next/server";
import { getCount, incrementCount } from "@/lib/visit-counter";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const WINDOW_MS = 60_000;
const MAX_POSTS_PER_WINDOW = 5;
const MAX_TRACKED_IPS = 1_000;

const recentPosts = new Map<string, number[]>();

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
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

/** Returns true when this IP has used up its POSTs for the current window. */
function isRateLimited(ip: string, now: number): boolean {
  if (recentPosts.size >= MAX_TRACKED_IPS) {
    for (const [key, stamps] of recentPosts) {
      if (stamps.every((t) => now - t >= WINDOW_MS)) recentPosts.delete(key);
    }
  }

  const stamps = (recentPosts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_POSTS_PER_WINDOW) {
    recentPosts.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentPosts.set(ip, stamps);
  return false;
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
