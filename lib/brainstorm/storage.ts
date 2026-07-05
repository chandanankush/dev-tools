/**
 * Versioned localStorage persistence for the single auto-saved board. The
 * debounce timer itself lives in the hook layer (useBrainstorm.ts), matching
 * EditorPad.tsx's precedent — this module stays a pure, synchronous I/O
 * wrapper so it's trivial to test without fake timers.
 */
import { createDefaultSettings, createEmptyScene, TOOL_NAMES } from "./types";
import { toJSON, fromJSON } from "./serialize";
import type { BrainstormSettings, Scene, ToolName } from "./types";

export const STORAGE_KEY = "brainstorm:scene:v1";
export const SETTINGS_KEY = "brainstorm:settings:v1";

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

export function saveSettings(settings: BrainstormSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Same rationale as saveScene: never break the editor over a failed write.
  }
}

function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && (TOOL_NAMES as readonly string[]).includes(value);
}

/**
 * Reads persisted UI settings, falling back to defaults for the whole object on
 * missing/malformed storage and per-field on any value that fails validation —
 * so a partially-corrupt entry still restores whatever fields are usable.
 */
export function loadSettings(): BrainstormSettings {
  const defaults = createDefaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return defaults;
    const s = parsed as Record<string, unknown>;
    return {
      tool: isToolName(s.tool) ? s.tool : defaults.tool,
      strokeColor: typeof s.strokeColor === "string" ? s.strokeColor : defaults.strokeColor,
      fillColor: typeof s.fillColor === "string" || s.fillColor === null ? (s.fillColor as string | null) : defaults.fillColor,
      strokeWidth: typeof s.strokeWidth === "number" && Number.isFinite(s.strokeWidth) ? s.strokeWidth : defaults.strokeWidth,
    };
  } catch {
    return defaults;
  }
}
