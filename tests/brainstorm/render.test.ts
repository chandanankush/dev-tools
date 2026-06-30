import { describe, it, expect } from "vitest";
import { drawScene, createDrawableCache } from "@/lib/brainstorm/render";
import { exportPng } from "@/lib/brainstorm/serialize";
import { createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { ShapeElement, FreedrawElement, TextElement } from "@/lib/brainstorm/types";
import type { Drawable } from "roughjs/bin/core";

// Minimal stand-in Drawable for the cache tests below — its content is never
// inspected, only how many times the build callback runs, so a cast past
// roughjs's full ResolvedOptions shape is reasonable here (real production
// drawables always come from lib/brainstorm/render.ts's buildRoughDrawable).
const fakeDrawable = (): Drawable => ({ shape: "rectangle", sets: [], options: {} }) as unknown as Drawable;

const rect: ShapeElement = {
  id: "r1",
  type: "rectangle",
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  strokeColor: "#000",
  strokeWidth: 1,
  fillColor: null,
  seed: 1,
};

const ellipse: ShapeElement = { ...rect, id: "e1", type: "ellipse" };
const line: ShapeElement = { ...rect, id: "l1", type: "line", h: 0 };
const arrow: ShapeElement = { ...rect, id: "a1", type: "arrow", h: 5 };
const freedraw: FreedrawElement = {
  id: "f1",
  type: "freedraw",
  points: [
    [0, 0],
    [5, 5],
    [10, 0],
  ],
  strokeColor: "#000",
  strokeWidth: 1,
  seed: 1,
};
const text: TextElement = { id: "t1", type: "text", x: 0, y: 0, text: "hi", fontSize: 14, strokeColor: "#000", strokeWidth: 1, seed: 1 };

const vp = { scrollX: 0, scrollY: 0, zoom: 1 };

describe("drawScene", () => {
  it("does not throw for an empty scene", () => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    expect(() => drawScene(ctx, createEmptyScene(), vp, createDrawableCache())).not.toThrow();
  });

  it("does not throw for a scene containing every element type", () => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    let scene = createEmptyScene();
    for (const el of [rect, ellipse, line, arrow, freedraw, text]) {
      scene = addElement(scene, el);
    }
    expect(() => drawScene(ctx, scene, vp, createDrawableCache())).not.toThrow();
  });

  it("does not throw at a non-1 zoom and non-zero scroll", () => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    const scene = addElement(createEmptyScene(), rect);
    expect(() => drawScene(ctx, scene, { scrollX: 50, scrollY: -30, zoom: 2.5 }, createDrawableCache())).not.toThrow();
  });
});

describe("drawable cache", () => {
  it("reuses the cached drawable for an unchanged element across renders (factory runs once, not twice)", () => {
    const cache = createDrawableCache();
    const ctx = document.createElement("canvas").getContext("2d")!;
    const scene = addElement(createEmptyScene(), rect);
    let buildCount = 0;
    const build = () => {
      buildCount++;
      return fakeDrawable();
    };
    drawScene(ctx, scene, vp, cache, build);
    drawScene(ctx, scene, vp, cache, build);
    expect(buildCount).toBe(1);
    expect(cache.size()).toBe(1);
  });

  it("rebuilds (and replaces, not duplicates) the cache entry when the element is mutated", () => {
    const cache = createDrawableCache();
    const ctx = document.createElement("canvas").getContext("2d")!;
    let buildCount = 0;
    const build = () => {
      buildCount++;
      return fakeDrawable();
    };
    const scene1 = addElement(createEmptyScene(), rect);
    drawScene(ctx, scene1, vp, cache, build);
    const scene2 = { ...scene1, elements: [{ ...rect, w: 50 }] };
    drawScene(ctx, scene2, vp, cache, build);
    expect(buildCount).toBe(2);
    expect(cache.size()).toBe(1);
  });
});

describe("exportPng", () => {
  it("resolves to a Blob for an empty scene without throwing", async () => {
    const blob = await exportPng(createEmptyScene());
    expect(blob).toBeInstanceOf(Blob);
  });

  it("resolves to a Blob for a populated scene", async () => {
    const scene = addElement(createEmptyScene(), rect);
    const blob = await exportPng(scene, { scale: 2 });
    expect(blob).toBeInstanceOf(Blob);
  });
});
