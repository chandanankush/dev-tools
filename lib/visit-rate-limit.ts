/**
 * In-memory rate limiter for the visitor counter's POST.
 *
 * Two limits, both over a sliding one-minute window:
 *   - per IP:   MAX_POSTS_PER_IP
 *   - overall:  MAX_POSTS_OVERALL
 *
 * The IP comes from request headers, which anyone who can reach the origin directly can
 * forge, so the per-IP limit only stops casual abuse. The overall limit is the backstop:
 * however many addresses a caller invents, the count cannot rise faster than
 * MAX_POSTS_OVERALL a minute. The trade-off is that a flood can use up that budget and
 * delay counting real visitors until the window passes — acceptable for a visitor count.
 *
 * Nothing here is persisted; IPs are forgotten once the window passes.
 */
export const WINDOW_MS = 60_000;
export const MAX_POSTS_PER_IP = 5;
export const MAX_POSTS_OVERALL = 2_500;

// Twice the overall limit, so pruning expired entries always brings the map well below it:
// at most MAX_POSTS_OVERALL addresses can have a live (unexpired) entry.
const PRUNE_AT_TRACKED_IPS = MAX_POSTS_OVERALL * 2;

const recentByIp = new Map<string, number[]>();
const recentOverall: number[] = [];

export function trackedIpCount(): number {
  return recentByIp.size;
}

/** Returns true when this IP, or the site overall, has used up its POSTs for the window. */
export function isRateLimited(ip: string, now: number): boolean {
  // Timestamps are appended in order, so expired ones are always at the front.
  while (recentOverall.length > 0 && now - recentOverall[0] >= WINDOW_MS) recentOverall.shift();

  // Checked before any per-IP bookkeeping: a flood of forged addresses is rejected here,
  // in O(1), without touching the map.
  if (recentOverall.length >= MAX_POSTS_OVERALL) return true;

  if (recentByIp.size >= PRUNE_AT_TRACKED_IPS) {
    for (const [key, stamps] of recentByIp) {
      if (stamps.every((t) => now - t >= WINDOW_MS)) recentByIp.delete(key);
    }
  }

  const stamps = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_POSTS_PER_IP) {
    recentByIp.set(ip, stamps);
    return true;
  }

  stamps.push(now);
  recentByIp.set(ip, stamps);
  recentOverall.push(now);
  return false;
}
