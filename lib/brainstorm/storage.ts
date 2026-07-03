/**
 * Versioned localStorage persistence for the single auto-saved board. The
 * debounce timer itself lives in the hook layer (useBrainstorm.ts), matching
 * EditorPad.tsx's precedent — this module stays a pure, synchronous I/O
 * wrapper so it's trivial to test without fake timers.
 */
import { createEmptyScene } from "./types";
import { toJSON, fromJSON } from "./serialize";
import type { Scene } from "./types";

export const STORAGE_KEY = "brainstorm:scene:v1";

export function saveScene(scene: Scene): void {
  try {
    localStorage.setItem(STORAGE_KEY, toJSON(scene));
  } catch {
    // Quota exceeded or storage unavailable (e.g. private browsing) — the
    // editor must keep working without persistence rather than crash.
  }
}

export function loadScene(): Scene {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyScene();
  const result = fromJSON(raw);
  return result.ok ? result.scene : createEmptyScene();
}
