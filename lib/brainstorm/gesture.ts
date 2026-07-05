/**
 * Two-finger touch navigation math — pure, DOM-free, so it is unit-testable
 * without synthesising TouchEvents (unreliable under jsdom). The component
 * layer (index.tsx) only samples the raw touch points and feeds them here.
 *
 * A gesture is expressed as the transition between two samples (previous frame
 * → current frame). Each step both pans by the midpoint's movement and zooms
 * about the current midpoint by the ratio of finger distances, so the content
 * under the fingers stays anchored — pan and zoom compose in a single update.
 */
import { pan, zoomAt } from "./viewport";
import type { Viewport } from "./types";

export type TouchPoint = { x: number; y: number };

export type PinchSample = { midpoint: TouchPoint; distance: number };

/** Midpoint and separation of two touch points (canvas-space coordinates). */
export function pinchSample(a: TouchPoint, b: TouchPoint): PinchSample {
  return {
    midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.hypot(a.x - b.x, a.y - b.y),
  };
}

/**
 * Next viewport for one pinch/pan step. Panning uses the midpoint delta; the
 * zoom factor is the distance ratio, applied about the current midpoint via
 * zoomAt (which clamps to the shared MIN/MAX zoom). A zero previous distance
 * (degenerate/first sample) yields no zoom rather than NaN.
 */
export function applyPinch(vp: Viewport, prev: PinchSample, current: PinchSample): Viewport {
  const panned = pan(vp, {
    dx: current.midpoint.x - prev.midpoint.x,
    dy: current.midpoint.y - prev.midpoint.y,
  });
  const zoomDelta = prev.distance > 0 ? current.distance / prev.distance - 1 : 0;
  return zoomAt(panned, current.midpoint, zoomDelta);
}
