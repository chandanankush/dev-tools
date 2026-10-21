import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Limiter = typeof import("@/lib/visit-rate-limit");

async function load(): Promise<Limiter> {
  vi.resetModules();
  return import("@/lib/visit-rate-limit");
}

const T0 = Date.parse("2026-01-01T00:00:00Z");
const ip = (n: number) => `ip-${n}`;

describe("visit-rate-limit", () => {
  let limiter: Limiter;

  beforeEach(async () => {
    limiter = await load();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("per IP", () => {
    it("allows MAX_POSTS_PER_IP, then blocks that IP only", () => {
      const { isRateLimited, MAX_POSTS_PER_IP } = limiter;

      for (let i = 0; i < MAX_POSTS_PER_IP; i++) expect(isRateLimited(ip(1), T0 + i)).toBe(false);

      expect(isRateLimited(ip(1), T0 + 10)).toBe(true);
      expect(isRateLimited(ip(2), T0 + 10)).toBe(false);
    });

    it("allows the IP again once its window has passed", () => {
      const { isRateLimited, MAX_POSTS_PER_IP, WINDOW_MS } = limiter;
      for (let i = 0; i < MAX_POSTS_PER_IP; i++) isRateLimited(ip(1), T0);

      expect(isRateLimited(ip(1), T0 + WINDOW_MS - 1)).toBe(true);
      expect(isRateLimited(ip(1), T0 + WINDOW_MS)).toBe(false);
    });

    it("does not count blocked attempts against the window", () => {
      const { isRateLimited, MAX_POSTS_PER_IP, WINDOW_MS } = limiter;
      for (let i = 0; i < MAX_POSTS_PER_IP; i++) isRateLimited(ip(1), T0);
      for (let i = 0; i < 50; i++) isRateLimited(ip(1), T0 + 30_000);

      expect(isRateLimited(ip(1), T0 + WINDOW_MS)).toBe(false);
    });
  });

  describe("overall", () => {
    it("caps increments overall even when every request claims a different IP", () => {
      const { isRateLimited, MAX_POSTS_OVERALL } = limiter;

      let allowed = 0;
      for (let i = 0; i < MAX_POSTS_OVERALL + 500; i++) {
        if (!isRateLimited(ip(i), T0)) allowed++;
      }

      expect(allowed).toBe(MAX_POSTS_OVERALL);
    });

    it("is 2,500 a minute", () => {
      expect(limiter.MAX_POSTS_OVERALL).toBe(2_500);
    });

    it("resumes once the window has passed", () => {
      const { isRateLimited, MAX_POSTS_OVERALL, WINDOW_MS } = limiter;
      for (let i = 0; i < MAX_POSTS_OVERALL; i++) isRateLimited(ip(i), T0);

      expect(isRateLimited(ip(-1), T0 + WINDOW_MS - 1)).toBe(true);
      expect(isRateLimited(ip(-1), T0 + WINDOW_MS)).toBe(false);
    });

    it("rejects a flood without touching the per-IP map", () => {
      const { isRateLimited, trackedIpCount, MAX_POSTS_OVERALL } = limiter;
      for (let i = 0; i < MAX_POSTS_OVERALL; i++) isRateLimited(ip(i), T0);
      const tracked = trackedIpCount();

      for (let i = 0; i < 10_000; i++) isRateLimited(`flood-${i}`, T0 + 1);

      expect(trackedIpCount()).toBe(tracked);
    });
  });

  describe("memory", () => {
    it("keeps the per-IP map bounded across many windows of distinct addresses", () => {
      const { isRateLimited, trackedIpCount, MAX_POSTS_OVERALL, WINDOW_MS } = limiter;

      let peak = 0;
      for (let window = 0; window < 6; window++) {
        const start = T0 + window * WINDOW_MS;
        for (let i = 0; i < MAX_POSTS_OVERALL; i++) {
          expect(isRateLimited(`w${window}-${i}`, start)).toBe(false);
          peak = Math.max(peak, trackedIpCount());
        }
      }

      expect(peak).toBeLessThanOrEqual(MAX_POSTS_OVERALL * 2);
    });
  });
});
