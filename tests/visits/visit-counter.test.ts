import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;

async function loadModule() {
  vi.resetModules();
  return import("@/lib/visit-counter");
}

async function readStored(): Promise<{ count: number; updatedAt: string }> {
  return JSON.parse(await readFile(path.join(dir, "visits.json"), "utf8"));
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "visits-"));
  process.env.VISITS_DATA_DIR = dir;
});

afterEach(async () => {
  delete process.env.VISITS_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("visit-counter", () => {
  it("starts at 0 when no file exists", async () => {
    const { getCount } = await loadModule();
    expect(await getCount()).toBe(0);
  });

  it("increments and persists the count", async () => {
    const { incrementCount, getCount } = await loadModule();

    expect(await incrementCount()).toBe(1);
    expect(await incrementCount()).toBe(2);
    expect(await incrementCount()).toBe(3);

    expect(await getCount()).toBe(3);
    const stored = await readStored();
    expect(stored.count).toBe(3);
    expect(Number.isNaN(Date.parse(stored.updatedAt))).toBe(false);
  });

  it("stores only the count and a timestamp — nothing about visitors", async () => {
    const { incrementCount } = await loadModule();
    await incrementCount();

    expect(Object.keys(await readStored()).sort()).toEqual(["count", "updatedAt"]);
  });

  it("restores the count after a restart", async () => {
    const first = await loadModule();
    await first.incrementCount();
    await first.incrementCount();

    const second = await loadModule();
    expect(await second.getCount()).toBe(2);
    expect(await second.incrementCount()).toBe(3);
  });

  it("does not lose updates under concurrent increments", async () => {
    const { incrementCount, getCount } = await loadModule();

    const results = await Promise.all(Array.from({ length: 50 }, () => incrementCount()));

    expect(new Set(results).size).toBe(50);
    expect(Math.max(...results)).toBe(50);
    expect(await getCount()).toBe(50);
    expect((await readStored()).count).toBe(50);
  });

  it("leaves no temp file behind", async () => {
    const { incrementCount } = await loadModule();
    await incrementCount();

    await expect(access(path.join(dir, "visits.json.tmp"))).rejects.toThrow();
  });

  it("keeps a damaged file aside and restarts from 0", async () => {
    await writeFile(path.join(dir, "visits.json"), "{not json");
    const { getCount, incrementCount } = await loadModule();

    expect(await getCount()).toBe(0);
    expect(await readFile(path.join(dir, "visits.json.corrupt"), "utf8")).toBe("{not json");
    expect(await incrementCount()).toBe(1);
  });

  it.each([
    ["negative", { count: -4 }],
    ["fractional", { count: 1.5 }],
    ["string", { count: "12" }],
    ["missing", {}],
    ["null", null],
  ])("treats a %s count as damaged", async (_label, content) => {
    await writeFile(path.join(dir, "visits.json"), JSON.stringify(content));
    const { getCount } = await loadModule();

    expect(await getCount()).toBe(0);
  });

  it("rejects, and does not advance the count, when the file cannot be written", async () => {
    const blocker = path.join(dir, "not-a-dir");
    await writeFile(blocker, "x");
    process.env.VISITS_DATA_DIR = path.join(blocker, "data");
    const { incrementCount, getCount } = await loadModule();

    await expect(incrementCount()).rejects.toThrow();
    expect(await getCount()).toBe(0);
  });

  it("keeps working after a failed write", async () => {
    const blocker = path.join(dir, "not-a-dir");
    await writeFile(blocker, "x");
    const failing = path.join(blocker, "data");
    process.env.VISITS_DATA_DIR = failing;
    const { incrementCount } = await loadModule();
    await expect(incrementCount()).rejects.toThrow();

    process.env.VISITS_DATA_DIR = dir;
    expect(await incrementCount()).toBe(1);
  });
});
