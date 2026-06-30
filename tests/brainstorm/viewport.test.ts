import { describe, it, expect } from "vitest";
import { screenToWorld, worldToScreen, zoomAt, pan } from "@/lib/brainstorm/viewport";
import type { Viewport } from "@/lib/brainstorm/types";

const vp: Viewport = { scrollX: 0, scrollY: 0, zoom: 1 };

describe("screenToWorld / worldToScreen", () => {
  it("round-trips at zoom 1", () => {
    const world = screenToWorld({ x: 100, y: 50 }, vp);
    expect(worldToScreen(world, vp)).toEqual({ x: 100, y: 50 });
  });

  it("round-trips at non-1 zoom and non-zero scroll", () => {
    const vp2: Viewport = { scrollX: 30, scrollY: -20, zoom: 2.5 };
    const world = screenToWorld({ x: 200, y: 150 }, vp2);
    const back = worldToScreen(world, vp2);
    expect(back.x).toBeCloseTo(200);
    expect(back.y).toBeCloseTo(150);
  });
});

describe("zoomAt", () => {
  it("keeps the cursor's world point fixed on screen after zooming", () => {
    const cursor = { x: 400, y: 300 };
    const before = screenToWorld(cursor, vp);
    const next = zoomAt(vp, cursor, 0.1); // zoom in
    const after = screenToWorld(cursor, next);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(next.zoom).toBeGreaterThan(vp.zoom);
  });

  it("keeps the cursor's world point fixed when zooming out too", () => {
    const cursor = { x: 50, y: 80 };
    const start: Viewport = { scrollX: 10, scrollY: 5, zoom: 2 };
    const before = screenToWorld(cursor, start);
    const next = zoomAt(start, cursor, -0.2);
    const after = screenToWorld(cursor, next);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(next.zoom).toBeLessThan(start.zoom);
  });

  it("clamps zoom to a sane min/max range", () => {
    const tinyZoom = zoomAt({ ...vp, zoom: 0.05 }, { x: 0, y: 0 }, -10);
    const hugeZoom = zoomAt({ ...vp, zoom: 20 }, { x: 0, y: 0 }, 10);
    expect(tinyZoom.zoom).toBeGreaterThanOrEqual(0.1);
    expect(hugeZoom.zoom).toBeLessThanOrEqual(10);
  });
});

describe("pan", () => {
  it("shifts scrollX/scrollY by the given screen-space delta", () => {
    const next = pan(vp, { dx: 10, dy: -5 });
    expect(next).toEqual({ ...vp, scrollX: 10, scrollY: -5 });
  });

  it("leaves zoom unchanged", () => {
    const start: Viewport = { scrollX: 0, scrollY: 0, zoom: 3 };
    expect(pan(start, { dx: 1, dy: 1 }).zoom).toBe(3);
  });
});
