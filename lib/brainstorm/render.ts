/**
 * Canvas2D rendering, backed by roughjs for sketchy rectangle/ellipse/line/
 * arrow strokes. Freedraw and text bypass roughjs entirely — freehand
 * points are already organic (no sketchiness needed) and text has no
 * roughjs primitive, so both are drawn with plain Canvas2D calls.
 *
 * Per-element drawable cache: roughjs's generator re-randomizes its sketchy
 * path on every call unless the same `seed` is reused, but more importantly,
 * regenerating the path data for unchanged elements on every animation frame
 * is wasted work — this cache keys on element id and a structural
 * fingerprint of the element, so an unchanged element's Drawable is reused
 * across frames and only rebuilt when the element actually changes.
 */
import rough from "roughjs";
import type { Drawable } from "roughjs/bin/core";
import type { Element, FreedrawElement, ShapeElement, TextElement, Scene, Viewport } from "./types";

export type DrawableCache = {
  getOrCreate: (id: string, signature: string, build: () => unknown) => unknown;
  size: () => number;
};

export function createDrawableCache(): DrawableCache {
  const store = new Map<string, { drawable: unknown; signature: string }>();
  return {
    getOrCreate(id, signature, build) {
      const cached = store.get(id);
      if (cached && cached.signature === signature) return cached.drawable;
      const drawable = build();
      store.set(id, { drawable, signature });
      return drawable;
    },
    size() {
      return store.size;
    },
  };
}

// Stateless aside from defaultOptions, and roughjs's generator doesn't need
// a canvas to build (unattached) Drawable objects — only RoughCanvas.draw()
// (constructed per-frame below, bound to the live ctx.canvas) needs one.
const generator = rough.generator();

const ARROWHEAD_SPREAD_RADIANS = 0.5;
const ARROWHEAD_MAX_LENGTH = 20;
const ARROWHEAD_LENGTH_RATIO = 0.3;

export function buildRoughDrawable(element: ShapeElement): Drawable | Drawable[] {
  const options = {
    seed: element.seed,
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    fill: element.fillColor ?? undefined,
  };

  switch (element.type) {
    case "rectangle":
      return generator.rectangle(element.x, element.y, element.w, element.h, options);
    case "ellipse": {
      // roughjs's ellipse(x, y, ...) takes the *center*, but ShapeElement
      // stores the top-left corner (same convention as rectangle) — convert.
      const centerX = element.x + element.w / 2;
      const centerY = element.y + element.h / 2;
      return generator.ellipse(centerX, centerY, element.w, element.h, options);
    }
    case "line":
      return generator.line(element.x, element.y, element.x + element.w, element.y + element.h, options);
    case "arrow": {
      const x1 = element.x;
      const y1 = element.y;
      const x2 = element.x + element.w;
      const y2 = element.y + element.h;
      const shaft = generator.line(x1, y1, x2, y2, options);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const lineLength = Math.hypot(x2 - x1, y2 - y1);
      const headLength = Math.min(ARROWHEAD_MAX_LENGTH, lineLength * ARROWHEAD_LENGTH_RATIO);
      const head1 = generator.line(
        x2,
        y2,
        x2 - headLength * Math.cos(angle - ARROWHEAD_SPREAD_RADIANS),
        y2 - headLength * Math.sin(angle - ARROWHEAD_SPREAD_RADIANS),
        options
      );
      const head2 = generator.line(
        x2,
        y2,
        x2 - headLength * Math.cos(angle + ARROWHEAD_SPREAD_RADIANS),
        y2 - headLength * Math.sin(angle + ARROWHEAD_SPREAD_RADIANS),
        options
      );
      return [shaft, head1, head2];
    }
  }
}

function drawFreedraw(ctx: CanvasRenderingContext2D, element: FreedrawElement): void {
  if (element.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = element.strokeColor;
  ctx.lineWidth = element.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const [firstX, firstY] = element.points[0];
  ctx.moveTo(firstX, firstY);

  if (element.points.length === 1) {
    // A single recorded point (a tap with no drag) — draw a short dot by
    // stroking a zero-length path back onto itself.
    ctx.lineTo(firstX, firstY);
  } else {
    // Quadratic-curve smoothing through consecutive point midpoints — a
    // hand-rolled freehand stroke (no perfect-freehand dependency, per spec).
    for (let i = 1; i < element.points.length - 1; i++) {
      const [cx, cy] = element.points[i];
      const [nx, ny] = element.points[i + 1];
      ctx.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
    }
    const [lastX, lastY] = element.points[element.points.length - 1];
    ctx.lineTo(lastX, lastY);
  }

  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, element: TextElement): void {
  ctx.save();
  ctx.fillStyle = element.strokeColor;
  ctx.font = `${element.fontSize}px sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(element.text, element.x, element.y);
  ctx.restore();
}

/**
 * Renders the full scene into `ctx`, applying the viewport transform so all
 * element coordinates can stay in world space.
 *
 * `buildDrawable` is overridable (defaults to `buildRoughDrawable`) purely
 * so tests can count how many times the build callback actually runs,
 * without reaching into the cache's internals — production call sites
 * (components/tools/Brainstorm/index.tsx) never pass it.
 *
 * Critical: the roughjs canvas binding (`rough.canvas(...)`) must be
 * constructed from `ctx.canvas` — the real <canvas> element — not from `ctx`
 * itself. RoughCanvas's constructor calls `this.canvas.getContext('2d')`
 * internally rather than using the ctx passed into this function, so
 * `ctx.canvas` must be a real canvas element whose own `getContext` resolves
 * to an equivalent context (true both in the browser and under the
 * tests/setup.ts canvas stub).
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  viewport: Viewport,
  cache: DrawableCache,
  buildDrawable: (element: ShapeElement) => Drawable | Drawable[] = buildRoughDrawable
): void {
  const canvas = ctx.canvas;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(viewport.scrollX, viewport.scrollY);
  ctx.scale(viewport.zoom, viewport.zoom);

  const roughCanvas = rough.canvas(canvas);

  for (const element of scene.elements) {
    drawElement(ctx, roughCanvas, element, cache, buildDrawable);
  }

  ctx.restore();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  roughCanvas: ReturnType<typeof rough.canvas>,
  element: Element,
  cache: DrawableCache,
  buildDrawable: (element: ShapeElement) => Drawable | Drawable[]
): void {
  switch (element.type) {
    case "rectangle":
    case "ellipse":
    case "line":
    case "arrow": {
      const signature = JSON.stringify(element);
      const drawable = cache.getOrCreate(element.id, signature, () => buildDrawable(element)) as Drawable | Drawable[];
      for (const d of Array.isArray(drawable) ? drawable : [drawable]) {
        roughCanvas.draw(d);
      }
      break;
    }
    case "freedraw":
      drawFreedraw(ctx, element);
      break;
    case "text":
      drawText(ctx, element);
      break;
  }
}
