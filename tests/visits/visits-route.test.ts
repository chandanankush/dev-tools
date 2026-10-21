import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/visits/route");
}

function post(headers: Record<string, string> = {}) {
  return new Request("http://localhost:3050/api/visits", { method: "POST", headers });
}

let ipCounter = 0;
const freshIp = () => `203.0.113.${++ipCounter}`;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "visits-route-"));
  process.env.VISITS_DATA_DIR = dir;
});

afterEach(async () => {
  vi.useRealTimers();
  delete process.env.VISITS_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/visits", () => {
  it("returns the current count, uncached", async () => {
    const { GET } = await loadRoute();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 0 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/visits", () => {
  it("increments the count and returns it, uncached", async () => {
    const { POST, GET } = await loadRoute();
    const ip = freshIp();

    const first = await POST(post({ "cf-connecting-ip": ip }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ count: 1 });
    expect(first.headers.get("cache-control")).toBe("no-store");

    expect(await (await GET()).json()).toEqual({ count: 1 });
  });

  it("accepts same-origin browser requests", async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ "sec-fetch-site": "same-origin", "cf-connecting-ip": freshIp() }));

    expect(response.status).toBe(200);
  });

  it.each(["cross-site", "same-site", "none"])("rejects Sec-Fetch-Site: %s without counting", async (site) => {
    const { POST, GET } = await loadRoute();
    const response = await POST(post({ "sec-fetch-site": site, "cf-connecting-ip": freshIp() }));

    expect(response.status).toBe(403);
    expect(await (await GET()).json()).toEqual({ count: 0 });
  });

  it("rejects a foreign Origin when Sec-Fetch-Site is absent", async () => {
    const { POST, GET } = await loadRoute();
    const response = await POST(
      post({ origin: "https://evil.example", host: "localhost:3050", "cf-connecting-ip": freshIp() }),
    );

    expect(response.status).toBe(403);
    expect(await (await GET()).json()).toEqual({ count: 0 });
  });

  it("accepts a matching Origin when Sec-Fetch-Site is absent", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post({ origin: "http://localhost:3050", host: "localhost:3050", "cf-connecting-ip": freshIp() }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects an unparseable Origin", async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ origin: "not a url", "cf-connecting-ip": freshIp() }));

    expect(response.status).toBe(403);
  });

  it("rate-limits one IP to 5 increments per minute, others unaffected", async () => {
    const { POST, GET } = await loadRoute();
    const ip = freshIp();

    for (let i = 0; i < 5; i++) {
      expect((await POST(post({ "cf-connecting-ip": ip }))).status).toBe(200);
    }
    const blocked = await POST(post({ "cf-connecting-ip": ip }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");

    expect((await POST(post({ "cf-connecting-ip": freshIp() }))).status).toBe(200);
    expect(await (await GET()).json()).toEqual({ count: 6 });
  });

  it("lets an IP count again once the window has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { POST } = await loadRoute();
    const ip = freshIp();

    for (let i = 0; i < 5; i++) await POST(post({ "cf-connecting-ip": ip }));
    expect((await POST(post({ "cf-connecting-ip": ip }))).status).toBe(429);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect((await POST(post({ "cf-connecting-ip": ip }))).status).toBe(200);
  });

  it("keys on the rightmost x-forwarded-for hop, which a client cannot forge", async () => {
    const { POST } = await loadRoute();
    const proxySeen = freshIp();

    // the client prepends a different fake address every time; the proxy-appended hop is constant
    for (let i = 0; i < 5; i++) {
      expect((await POST(post({ "x-forwarded-for": `198.51.100.${i}, ${proxySeen}` }))).status).toBe(200);
    }
    expect((await POST(post({ "x-forwarded-for": `198.51.100.99, ${proxySeen}` }))).status).toBe(429);
  });

  it("caps increments overall, so forged addresses cannot inflate the count", async () => {
    const { POST, GET } = await loadRoute();

    for (let i = 0; i < 60; i++) {
      expect((await POST(post({ "cf-connecting-ip": freshIp() }))).status).toBe(200);
    }
    const blocked = await POST(post({ "cf-connecting-ip": freshIp() }));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
    expect(await (await GET()).json()).toEqual({ count: 60 });
  });

  it("resumes counting once the overall window has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { POST } = await loadRoute();

    for (let i = 0; i < 60; i++) await POST(post({ "cf-connecting-ip": freshIp() }));
    expect((await POST(post({ "cf-connecting-ip": freshIp() }))).status).toBe(429);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect((await POST(post({ "cf-connecting-ip": freshIp() }))).status).toBe(200);
  });

  it("does not spend overall budget on rejected requests", async () => {
    const { POST, GET } = await loadRoute();

    for (let i = 0; i < 100; i++) await POST(post({ "sec-fetch-site": "cross-site", "cf-connecting-ip": freshIp() }));
    for (let i = 0; i < 5; i++) {
      expect((await POST(post({ "cf-connecting-ip": freshIp() }))).status).toBe(200);
    }
    expect(await (await GET()).json()).toEqual({ count: 5 });
  });

  it("returns a generic 500 and does not leak paths when storage fails", async () => {
    const blocker = path.join(dir, "not-a-dir");
    await writeFile(blocker, "x");
    process.env.VISITS_DATA_DIR = path.join(blocker, "data");
    const { POST } = await loadRoute();

    const response = await POST(post({ "cf-connecting-ip": freshIp() }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Unable to record visit." });
    expect(JSON.stringify(body)).not.toContain(dir);
  });
});
