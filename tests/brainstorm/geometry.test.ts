import { describe, it, expect } from "vitest";
import { boundingBox, boxesIntersect, normalizeShape, distToSegment, hitTest, resizeShape, unionBox } from "@/lib/brainstorm/geometry";
import type { ShapeElement, FreedrawElement, TextElement } from "@/lib/brainstorm/types";

const baseShape = {
  strokeColor: "#000",
  strokeWidth: 2,
  fillColor: null as string | null,
  seed: 1,
};

function rect(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return { id: "r1", type: "rectangle", x: 0, y: 0, w: 10, h: 10, ...baseShape, ...overrides };
}

function line(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return { id: "l1", type: "line", x: 0, y: 0, w: 10, h: 0, ...baseShape, ...overrides };
}

function arrow(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return { id: "a1", type: "arrow", x: 0, y: 0, w: 10, h: 0, ...baseShape, ...overrides };
}

describe("boundingBox", () => {
  it("rectangle: normalizes a positive w/h box", () => {
    expect(boundingBox(rect())).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("rectangle: normalizes a negative w/h box without mutating the element", () => {
    const el = rect({ x: 10, y: 10, w: -10, h: -10 });
    expect(boundingBox(el)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(el.w).toBe(-10); // unmutated
  });

  it("ellipse: same box logic as rectangle", () => {
    const el: ShapeElement = { ...rect(), type: "ellipse" };
    expect(boundingBox(el)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("line: box spans both endpoints regardless of direction", () => {
    const el = line({ x: 10, y: 10, w: -10, h: -10 });
    expect(boundingBox(el)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("arrow: box spans both endpoints", () => {
    expect(boundingBox(arrow({ x: 0, y: 0, w: 10, h: 5 }))).toEqual({ x: 0, y: 0, w: 10, h: 5 });
  });

  it("freedraw: box covers all points", () => {
    const el: FreedrawElement = {
      id: "f1",
      type: "freedraw",
      points: [
        [5, 5],
        [0, 10],
        [10, 0],
      ],
      strokeColor: "#000",
      strokeWidth: 1,
      seed: 1,
    };
    expect(boundingBox(el)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("freedraw: empty points returns a zero box, not NaN", () => {
    const el: FreedrawElement = { id: "f2", type: "freedraw", points: [], strokeColor: "#000", strokeWidth: 1, seed: 1 };
    expect(boundingBox(el)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it("text: estimates width/height from fontSize and text length", () => {
    const el: TextElement = { id: "t1", type: "text", x: 5, y: 5, text: "hello", fontSize: 20, strokeColor: "#000", strokeWidth: 1, seed: 1 };
    const box = boundingBox(el);
    expect(box.x).toBe(5);
    expect(box.y).toBe(5);
    expect(box.w).toBeGreaterThan(0);
    expect(box.h).toBeGreaterThan(0);
  });
});

describe("normalizeShape", () => {
  it("rectangle: flips negative w/h to positive, adjusting x/y to preserve the visual rect", () => {
    const el = rect({ x: 10, y: 10, w: -10, h: -10 });
    const normalized = normalizeShape(el);
    expect(normalized).toEqual({ ...el, x: 0, y: 0, w: 10, h: 10 });
  });

  it("rectangle: already-positive w/h is unchanged", () => {
    const el = rect();
    expect(normalizeShape(el)).toEqual(el);
  });

  it("line: is a no-op even with negative w/h (direction must be preserved)", () => {
    const el = line({ x: 10, y: 10, w: -10, h: -10 });
    expect(normalizeShape(el)).toEqual(el);
  });

  it("arrow: is a no-op (flipping would reverse the arrowhead end)", () => {
    const el = arrow({ x: 10, y: 0, w: -10, h: 0 });
    expect(normalizeShape(el)).toEqual(el);
  });
});

describe("distToSegment", () => {
  it("point on the segment is ~0", () => {
    expect(distToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
  });

  it("point off the perpendicular returns the perpendicular distance", () => {
    expect(distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it("point beyond the segment's end clamps to the endpoint distance", () => {
    expect(distToSegment({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });

  it("degenerate segment (a === b) returns distance to the point, not NaN", () => {
    const d = distToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(d).toBeCloseTo(5);
    expect(Number.isNaN(d)).toBe(false);
  });
});

describe("hitTest", () => {
  it("rectangle: a point inside the bbox hits", () => {
    expect(hitTest({ x: 5, y: 5 }, rect(), 1)).toBe(true);
  });

  it("rectangle: a point far outside the bbox misses", () => {
    expect(hitTest({ x: 500, y: 500 }, rect(), 1)).toBe(false);
  });

  it("line: a point within tolerance of the segment hits", () => {
    expect(hitTest({ x: 5, y: 1 }, line(), 1)).toBe(true);
  });

  it("line: a point far from the segment misses", () => {
    expect(hitTest({ x: 5, y: 100 }, line(), 1)).toBe(false);
  });

  it("hit tolerance scales inversely with zoom: misses at zoom 1, hits at zoom 0.1 for the same screen-space distance", () => {
    const point = { x: 5, y: 20 }; // 20 world units off the line at y=0
    expect(hitTest(point, line(), 1)).toBe(false);
    expect(hitTest(point, line(), 0.1)).toBe(true);
  });

  it("freedraw: a point near any segment hits", () => {
    const el: FreedrawElement = {
      id: "f1",
      type: "freedraw",
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      strokeColor: "#000",
      strokeWidth: 2,
      seed: 1,
    };
    expect(hitTest({ x: 10, y: 5 }, el, 1)).toBe(true);
    expect(hitTest({ x: 500, y: 500 }, el, 1)).toBe(false);
  });

  it("freedraw: empty points never hits", () => {
    const el: FreedrawElement = { id: "f2", type: "freedraw", points: [], strokeColor: "#000", strokeWidth: 1, seed: 1 };
    expect(hitTest({ x: 0, y: 0 }, el, 1)).toBe(false);
  });
});

describe("resizeShape", () => {
  it("se handle: keeps the nw corner fixed and grows w/h by (dx, dy)", () => {
    const result = resizeShape(rect(), "se", 5, 5);
    expect(result).toMatchObject({ x: 0, y: 0, w: 15, h: 15 });
  });

  it("nw handle: keeps the se corner fixed", () => {
    const result = resizeShape(rect(), "nw", 5, 5);
    expect(result).toMatchObject({ x: 5, y: 5, w: 5, h: 5 });
    // se corner (x+w, y+h) is unchanged at (10, 10)
    expect(result.x + result.w).toBeCloseTo(10);
    expect(result.y + result.h).toBeCloseTo(10);
  });

  it("ne handle: keeps the sw corner fixed", () => {
    const result = resizeShape(rect(), "ne", 5, -5);
    expect(result.x).toBeCloseTo(0); // sw.x = x, unchanged
    expect(result.y + result.h).toBeCloseTo(10); // sw.y = y + h, unchanged
    expect(result.w).toBeCloseTo(15);
  });

  it("sw handle: keeps the ne corner fixed", () => {
    const result = resizeShape(rect(), "sw", -5, 5);
    expect(result.x + result.w).toBeCloseTo(10); // ne.x = x + w, unchanged
    expect(result.y).toBeCloseTo(0); // ne.y = y, unchanged
    expect(result.h).toBeCloseTo(15);
  });

  it("dragging past the opposite corner flips sign and re-normalizes instead of leaving negative w/h", () => {
    const result = resizeShape(rect(), "se", -20, -20);
    expect(result.w).toBeGreaterThan(0);
    expect(result.h).toBeGreaterThan(0);
    // The original nw corner (0,0) — the one "se" was supposed to keep fixed
    // — must still be one of the resulting rect's corners after the flip.
    const corners = [
      { x: result.x, y: result.y },
      { x: result.x + result.w, y: result.y + result.h },
    ];
    expect(corners.some((c) => c.x === 0 && c.y === 0)).toBe(true);
  });

  it("line: se handle moves the end point, start point (nw-equivalent) stays fixed, direction preserved", () => {
    const result = resizeShape(line(), "se", 5, 5);
    expect(result).toMatchObject({ x: 0, y: 0, w: 15, h: 5 });
  });

  it("arrow: nw handle moves the start point, end point stays fixed, head direction preserved", () => {
    const original = arrow({ x: 0, y: 0, w: 10, h: 0 });
    const result = resizeShape(original, "nw", 2, 0);
    // end point (x+w, y+h) must be unchanged at (10, 0)
    expect(result.x + result.w).toBeCloseTo(10);
    expect(result.y + result.h).toBeCloseTo(0);
  });
});

describe("boxesIntersect", () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };

  it("returns true for overlapping boxes", () => {
    expect(boxesIntersect(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it("returns true when one box fully contains the other", () => {
    expect(boxesIntersect(a, { x: 2, y: 2, w: 3, h: 3 })).toBe(true);
  });

  it("returns false for disjoint boxes", () => {
    expect(boxesIntersect(a, { x: 20, y: 0, w: 5, h: 5 })).toBe(false);
  });

  it("treats edge-touching (zero-area overlap) as no intersection", () => {
    expect(boxesIntersect(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });
});

describe("unionBox", () => {
  it("returns a zero box for empty input", () => {
    expect(unionBox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it("returns the same box for a single input", () => {
    expect(unionBox([{ x: 3, y: 4, w: 5, h: 6 }])).toEqual({ x: 3, y: 4, w: 5, h: 6 });
  });

  it("encloses every input box", () => {
    const result = unionBox([
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 20, y: 5, w: 10, h: 30 },
    ]);
    expect(result).toEqual({ x: 0, y: 0, w: 30, h: 35 });
  });
});
