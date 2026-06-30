/**
 * Pure reducers over Scene/Element. No randomness except duplicateElement's
 * new id, no DOM/canvas access — these are the load-bearing, unit-tested
 * functions the hook layer (components/tools/Brainstorm/useBrainstorm.ts)
 * delegates all scene mutation to.
 */
import type { Element, Scene } from "./types";

export function addElement(scene: Scene, element: Element): Scene {
  return { ...scene, elements: [...scene.elements, element] };
}

/**
 * `patch` is intentionally `Partial<Element>` (a union of all three element
 * shapes) rather than a per-variant generic — callers (the pointer-handling
 * hook) only ever pass patches shaped for the element they just hit-tested,
 * so the wider type here doesn't introduce a reachable bug, just a narrower
 * compile-time guarantee than ideal.
 */
export function updateElement(scene: Scene, id: string, patch: Partial<Element>): Scene {
  if (!scene.elements.some((el) => el.id === id)) return scene;
  return {
    ...scene,
    elements: scene.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as Element) : el)),
  };
}

export function removeElement(scene: Scene, id: string): Scene {
  return { ...scene, elements: scene.elements.filter((el) => el.id !== id) };
}

const DUPLICATE_OFFSET = 10;

export function duplicateElement(scene: Scene, id: string): Scene {
  const original = scene.elements.find((el) => el.id === id);
  if (!original) return scene;

  const clone: Element =
    original.type === "freedraw"
      ? {
          ...original,
          id: crypto.randomUUID(),
          points: original.points.map(([x, y]) => [x + DUPLICATE_OFFSET, y + DUPLICATE_OFFSET] as [number, number]),
        }
      : {
          ...original,
          id: crypto.randomUUID(),
          x: original.x + DUPLICATE_OFFSET,
          y: original.y + DUPLICATE_OFFSET,
        };

  return addElement(scene, clone);
}
