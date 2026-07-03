/**
 * Scene JSON serialization. `toJSON`/`fromJSON` are the exact functions used
 * by both localStorage persistence (storage.ts) and the spec's JSON
 * export/import escape hatch — `fromJSON` must never throw into a caller
 * that doesn't expect it, since corrupt localStorage content or a
 * hand-edited imported file are both expected (not exceptional) inputs.
 */
import { boundingBox } from "./geometry";
import { createDrawableCache, drawScene } from "./render";
import type { Element, Scene } from "./types";

export function toJSON(scene: Scene): string {
  return JSON.stringify(scene);
}

export type FromJsonResult = { ok: true; scene: Scene } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasBaseFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.strokeColor === "string" &&
    typeof value.strokeWidth === "number" &&
    typeof value.seed === "number"
  );
}

function isValidElement(value: unknown): value is Element {
  if (!isRecord(value) || !hasBaseFields(value)) return false;
  switch (value.type) {
    case "freedraw":
      return (
        Array.isArray(value.points) &&
        value.points.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number")
      );
    case "rectangle":
    case "ellipse":
    case "line":
    case "arrow":
      return (
        typeof value.x === "number" &&
        typeof value.y === "number" &&
        typeof value.w === "number" &&
        typeof value.h === "number" &&
        (value.fillColor === null || typeof value.fillColor === "string")
      );
    case "text":
      return typeof value.x === "number" && typeof value.y === "number" && typeof value.text === "string" && typeof value.fontSize === "number";
    default:
      return false;
  }
}

export function fromJSON(text: string): FromJsonResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }

  if (!isRecord(parsed)) return { ok: false, error: "Scene must be a JSON object." };
  if (parsed.version !== 1) return { ok: false, error: "Unsupported or missing scene version." };
  if (!Array.isArray(parsed.elements)) return { ok: false, error: "Scene is missing an elements array." };
  if (!parsed.elements.every(isValidElement)) return { ok: false, error: "Scene contains an invalid element." };

  return { ok: true, scene: { version: 1, elements: parsed.elements } };
}

export type ExportPngOptions = { scale: number };

const PNG_EXPORT_PADDING = 20;

/**
 * Rasterizes the scene to a PNG Blob at `options.scale`x device pixels.
 *
 * Uses an in-memory `<canvas>` (not `OffscreenCanvas`) deliberately — Safari
 * support for OffscreenCanvas.convertToBlob is inconsistent, and this repo
 * has no SSR use case for it, so a plain detached canvas is the simpler,
 * more compatible choice.
 */
export async function exportPng(scene: Scene, options: ExportPngOptions = { scale: 2 }): Promise<Blob> {
  const box =
    scene.elements.length === 0
      ? { x: 0, y: 0, w: 1, h: 1 }
      : scene.elements.reduce(
          (acc, el) => {
            const b = boundingBox(el);
            const minX = Math.min(acc.x, b.x);
            const minY = Math.min(acc.y, b.y);
            const maxX = Math.max(acc.x + acc.w, b.x + b.w);
            const maxY = Math.max(acc.y + acc.h, b.y + b.h);
            return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
          },
          boundingBox(scene.elements[0])
        );

  const width = (box.w + PNG_EXPORT_PADDING * 2) * options.scale;
  const height = (box.h + PNG_EXPORT_PADDING * 2) * options.scale;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  // Map the scene's bounding box (minus padding) to the canvas origin, at
  // `options.scale`x zoom so the export is rendered at higher-than-1x
  // resolution rather than just upscaled afterward.
  const viewport = {
    scrollX: (PNG_EXPORT_PADDING - box.x) * options.scale,
    scrollY: (PNG_EXPORT_PADDING - box.y) * options.scale,
    zoom: options.scale,
  };

  drawScene(ctx, scene, viewport, createDrawableCache());

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode PNG."));
    }, "image/png");
  });
}
