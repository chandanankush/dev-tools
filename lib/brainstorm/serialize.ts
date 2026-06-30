/**
 * Scene JSON serialization. `toJSON`/`fromJSON` are the exact functions used
 * by both localStorage persistence (storage.ts) and the spec's JSON
 * export/import escape hatch — `fromJSON` must never throw into a caller
 * that doesn't expect it, since corrupt localStorage content or a
 * hand-edited imported file are both expected (not exceptional) inputs.
 *
 * `exportPng` is implemented in render.ts (Task 8) once drawScene exists —
 * it needs the render pipeline to rasterize a scene to a canvas. Calling it
 * before then throws "not implemented" rather than being silently wrong.
 */
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

export async function exportPng(): Promise<Blob> {
  throw new Error("exportPng is implemented in lib/brainstorm/render.ts (Task 8) once drawScene exists.");
}
