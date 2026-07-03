/**
 * Brainstorm scene data model.
 *
 * This is the exact shape that is auto-saved to localStorage and what JSON
 * export/import reads and writes — see docs/superpowers/specs/2026-07-01-brainstorm-whiteboard-design.md.
 *
 * `seed` on every element must be persisted: without a stable per-element
 * seed, roughjs re-randomizes its sketchy paths on every render, causing
 * visible jitter on pan/zoom.
 */

export type Scene = { version: 1; elements: Element[] };

export type Base = {
  id: string;
  strokeColor: string;
  strokeWidth: number;
  seed: number;
};

export type FreedrawElement = Base & {
  type: "freedraw";
  points: [number, number][];
};

export type ShapeElement = Base & {
  type: "rectangle" | "ellipse" | "line" | "arrow";
  x: number;
  y: number;
  w: number;
  h: number;
  fillColor: string | null;
};

export type TextElement = Base & {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
};

export type Element = FreedrawElement | ShapeElement | TextElement;

/** Session-only viewport state — never persisted as part of Scene. */
export type Viewport = { scrollX: number; scrollY: number; zoom: number };

export function createEmptyScene(): Scene {
  return { version: 1, elements: [] };
}
