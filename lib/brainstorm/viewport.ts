/**
 * Screen<->world coordinate transforms and zoom-to-cursor math. Viewport is
 * session-only state (never persisted as part of Scene — see types.ts).
 */
import type { Viewport } from "./types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export function screenToWorld(point: { x: number; y: number }, vp: Viewport) {
  return { x: (point.x - vp.scrollX) / vp.zoom, y: (point.y - vp.scrollY) / vp.zoom };
}

export function worldToScreen(point: { x: number; y: number }, vp: Viewport) {
  return { x: point.x * vp.zoom + vp.scrollX, y: point.y * vp.zoom + vp.scrollY };
}

/**
 * Zooms by `delta` (a fractional change, e.g. 0.1 = 10% zoom in) while
 * keeping the world point under `cursor` visually fixed on screen — the
 * scroll offset is solved for, not just the zoom level, otherwise the board
 * would appear to slide out from under the cursor on every wheel tick.
 */
export function zoomAt(vp: Viewport, cursor: { x: number; y: number }, delta: number): Viewport {
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * (1 + delta)));
  const worldBefore = screenToWorld(cursor, vp);
  return {
    zoom: nextZoom,
    scrollX: cursor.x - worldBefore.x * nextZoom,
    scrollY: cursor.y - worldBefore.y * nextZoom,
  };
}

export function pan(vp: Viewport, delta: { dx: number; dy: number }): Viewport {
  return { ...vp, scrollX: vp.scrollX + delta.dx, scrollY: vp.scrollY + delta.dy };
}
