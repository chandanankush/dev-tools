/**
 * Hit-testing, bounding boxes, and resize transforms — pure coordinate math,
 * no DOM/canvas access. This is the highest-risk module in the tool for
 * subtle bugs (hit-testing at non-1 zoom, negative w/h, resize-through-zero),
 * so every function here is exercised directly by tests/brainstorm/geometry.test.ts
 * rather than only indirectly through the hook.
 */
import type { Element, ShapeElement } from "./types";

export type ResizeHandle = "nw" | "ne" | "sw" | "se";

export type Box = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

/** Axis-aligned overlap test. Edge-touching (zero-area overlap) counts as no
 * intersection — this is the canonical marquee rule: an element is selected iff
 * its boundingBox intersects the marquee rectangle. Both boxes are assumed to
 * have non-negative w/h (normalize the marquee before calling). */
export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Smallest box enclosing every input box; a zero box for an empty input. */
export function unionBox(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function boundingBox(element: Element): Box {
  switch (element.type) {
    case "rectangle":
    case "ellipse":
    case "line":
    case "arrow": {
      // w/h may be negative (the shape was drawn up/left of its origin) —
      // boundingBox always normalizes the *returned* box regardless, without
      // mutating the element itself (see normalizeShape for why line/arrow
      // elements are never mutated this way).
      const x0 = Math.min(element.x, element.x + element.w);
      const y0 = Math.min(element.y, element.y + element.h);
      return { x: x0, y: y0, w: Math.abs(element.w), h: Math.abs(element.h) };
    }
    case "freedraw": {
      if (element.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      const xs = element.points.map(([x]) => x);
      const ys = element.points.map(([, y]) => y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case "text": {
      // Approximation: exact glyph metrics require a live canvas context
      // (ctx.measureText), and boundingBox is deliberately a pure function
      // usable from hit-testing/history without a DOM. 0.6 is an average
      // glyph-width-to-fontSize ratio for typical UI fonts; 1.2 is a
      // standard line-height multiplier. Adequate for hit-test tolerance;
      // not used anywhere that needs pixel-exact layout.
      return {
        x: element.x,
        y: element.y,
        w: element.text.length * element.fontSize * 0.6,
        h: element.fontSize * 1.2,
      };
    }
  }
}

/**
 * Normalizes a shape's x/y/w/h so w and h are non-negative, adjusting x/y to
 * keep the same visual rectangle.
 *
 * Deliberately a no-op for "line"/"arrow": their endpoints are directional —
 * (x,y) is the line's start and (x+w,y+h) is its end, and for an arrow the
 * head is drawn at the end. Normalizing would silently swap which endpoint
 * is which, flipping an arrow's direction. Rectangle/ellipse have no such
 * direction concept, so normalizing them is purely cosmetic/structural.
 */
export function normalizeShape(element: ShapeElement): ShapeElement {
  if (element.type === "line" || element.type === "arrow") {
    return element;
  }
  const box = boundingBox(element);
  return { ...element, x: box.x, y: box.y, w: box.w, h: box.h };
}

export function distToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    // Degenerate segment (a === b) — distance to the single point, not NaN
    // from a division by zero below.
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function pointInBox(point: Point, box: Box, tolerance: number): boolean {
  return (
    point.x >= box.x - tolerance &&
    point.x <= box.x + box.w + tolerance &&
    point.y >= box.y - tolerance &&
    point.y <= box.y + box.h + tolerance
  );
}

/** Minimum hit tolerance in *screen* pixels, before being converted to world
 * units by dividing by zoom — at low zoom, a thin line still needs a
 * generous hit target in screen space, so tolerance must grow as zoom
 * shrinks. */
const BASE_HIT_TOLERANCE_PX = 6;

function hitToleranceWorld(strokeWidth: number, zoom: number): number {
  return Math.max(strokeWidth / 2, BASE_HIT_TOLERANCE_PX / zoom);
}

export function hitTest(point: Point, element: Element, zoom: number): boolean {
  const tolerance = hitToleranceWorld(element.strokeWidth, zoom);
  switch (element.type) {
    case "rectangle":
    case "ellipse":
      // v1 simplification: ellipse hit-testing uses its bounding box rather
      // than the true elliptical boundary. Acceptable for a whiteboard tool
      // where precision selection near corners isn't critical.
      return pointInBox(point, boundingBox(element), tolerance);
    case "line":
    case "arrow": {
      const a = { x: element.x, y: element.y };
      const b = { x: element.x + element.w, y: element.y + element.h };
      return distToSegment(point, a, b) <= tolerance;
    }
    case "freedraw": {
      if (element.points.length === 0) return false;
      if (element.points.length === 1) {
        const [px, py] = element.points[0];
        return Math.hypot(point.x - px, point.y - py) <= tolerance;
      }
      for (let i = 0; i < element.points.length - 1; i++) {
        const [ax, ay] = element.points[i];
        const [bx, by] = element.points[i + 1];
        if (distToSegment(point, { x: ax, y: ay }, { x: bx, y: by }) <= tolerance) return true;
      }
      return false;
    }
    case "text":
      return pointInBox(point, boundingBox(element), tolerance);
  }
}

/**
 * Resizes by moving the corner identified by `handle`, keeping the opposite
 * corner fixed, then normalizing. Because normalizeShape no-ops for
 * line/arrow, applying this to those types is equivalent to "drag one
 * endpoint, keep the other fixed" (handle "se" drags the end point, "nw"
 * drags the start point) — exactly the per-endpoint dragging a line/arrow
 * needs, with no direction-flipping risk. For rectangle/ellipse it's a true
 * 4-corner resize, including correct behavior when dragging past the
 * opposite corner (resize "through zero") since normalizeShape re-derives
 * x/y/w/h from the (possibly negative) raw result.
 */
export function resizeShape(element: ShapeElement, handle: ResizeHandle, dx: number, dy: number): ShapeElement {
  let { x, y, w, h } = element;
  switch (handle) {
    case "se":
      w += dx;
      h += dy;
      break;
    case "nw":
      x += dx;
      y += dy;
      w -= dx;
      h -= dy;
      break;
    case "ne":
      y += dy;
      w += dx;
      h -= dy;
      break;
    case "sw":
      x += dx;
      w -= dx;
      h += dy;
      break;
  }
  return normalizeShape({ ...element, x, y, w, h });
}
