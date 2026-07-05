import { describe, it, expect } from "vitest";
import { pinchSample, applyPinch } from "@/lib/brainstorm/gesture";
import { screenToWorld } from "@/lib/brainstorm/viewport";
import type { Viewport } from "@/lib/brainstorm/types";

const vp: Viewport = { scrollX: 0, scrollY: 0, zoom: 1 };

describe("pinchSample", () => {
  it("computes the midpoint and distance of two touch points", () => {
    const s = pinchSample({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(s.midpoint).toEqual({ x: 5, y: 0 });
    expect(s.distance).toBe(10);
  });
});

describe("applyPinch", () => {
  it("pans by the midpoint delta when the finger distance is unchanged", () => {
    const prev = pinchSample({ x: 0, y: 0 }, { x: 100, y: 0 }); // mid (50,0), dist 100
    const next = pinchSample({ x: 20, y: 30 }, { x: 120, y: 30 }); // mid (70,30), dist 100
    const out = applyPinch(vp, prev, next);
    expect(out.zoom).toBe(1);
    expect(out.scrollX).toBeCloseTo(20);
    expect(out.scrollY).toBeCloseTo(30);
  });

  it("zooms by the distance ratio and keeps the world point under the midpoint fixed", () => {
    const prev = pinchSample({ x: 40, y: 50 }, { x: 60, y: 50 }); // mid (50,50), dist 20
    const next = pinchSample({ x: 30, y: 50 }, { x: 70, y: 50 }); // mid (50,50), dist 40
    const mid = { x: 50, y: 50 };
    const worldBefore = screenToWorld(mid, vp);
    const out = applyPinch(vp, prev, next);
    expect(out.zoom).toBeCloseTo(2); // 40 / 20
    const worldAfter = screenToWorld(mid, out);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
  });

  it("combines pan and zoom in a single step", () => {
    const prev = pinchSample({ x: 40, y: 50 }, { x: 60, y: 50 }); // mid (50,50), dist 20
    const next = pinchSample({ x: 40, y: 60 }, { x: 80, y: 60 }); // mid (60,60), dist 40
    const out = applyPinch(vp, prev, next);
    expect(out.zoom).toBeCloseTo(2);
    expect(out).not.toEqual({ ...vp, zoom: 2 }); // scroll moved too, not zoom-only
  });

  it("respects the shared maximum zoom limit", () => {
    const start: Viewport = { scrollX: 0, scrollY: 0, zoom: 9 };
    const prev = pinchSample({ x: 40, y: 50 }, { x: 60, y: 50 }); // dist 20
    const next = pinchSample({ x: 0, y: 50 }, { x: 100, y: 50 }); // dist 100 → x5 → clamps at 10
    expect(applyPinch(start, prev, next).zoom).toBe(10);
  });

  it("does not produce NaN when the previous distance is zero", () => {
    const prev = pinchSample({ x: 50, y: 50 }, { x: 50, y: 50 }); // dist 0
    const next = pinchSample({ x: 40, y: 50 }, { x: 60, y: 50 });
    const out = applyPinch(vp, prev, next);
    expect(Number.isNaN(out.zoom)).toBe(false);
    expect(out.zoom).toBe(1); // no zoom applied
  });
});
