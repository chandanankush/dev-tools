import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveScene, loadScene, saveSettings, loadSettings, STORAGE_KEY, SETTINGS_KEY } from "@/lib/brainstorm/storage";
import { createDefaultSettings, createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { BrainstormSettings, ShapeElement } from "@/lib/brainstorm/types";

beforeEach(() => localStorage.clear());

describe("saveScene / loadScene", () => {
  it("round-trips a scene through localStorage", () => {
    const rect: ShapeElement = {
      id: "r1",
      type: "rectangle",
      x: 0,
      y: 0,
      w: 5,
      h: 5,
      strokeColor: "#000",
      strokeWidth: 1,
      fillColor: null,
      seed: 1,
    };
    const scene = addElement(createEmptyScene(), rect);
    saveScene(scene);
    expect(loadScene()).toEqual(scene);
  });

  it("returns an empty scene when nothing is stored", () => {
    expect(loadScene()).toEqual(createEmptyScene());
  });

  it("returns an empty scene and does not throw when stored JSON is corrupt", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => loadScene()).not.toThrow();
    expect(loadScene()).toEqual(createEmptyScene());
  });

  it("returns an empty scene when stored JSON has the wrong version", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, elements: [] }));
    expect(loadScene()).toEqual(createEmptyScene());
  });

  it("swallows a quota-exceeded write error without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    expect(() => saveScene(createEmptyScene())).not.toThrow();
  });

  it("uses a versioned key so a future format change can be detected", () => {
    expect(STORAGE_KEY).toBe("brainstorm:scene:v1");
  });
});

describe("saveSettings / loadSettings", () => {
  const custom: BrainstormSettings = { tool: "pen", strokeColor: "#ff0000", fillColor: "#00ff00", strokeWidth: 8 };

  it("round-trips settings through localStorage", () => {
    saveSettings(custom);
    expect(loadSettings()).toEqual(custom);
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(createDefaultSettings());
  });

  it("returns defaults and does not throw when stored JSON is corrupt", () => {
    localStorage.setItem(SETTINGS_KEY, "{not json");
    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings()).toEqual(createDefaultSettings());
  });

  it("falls back per-field when individual values are invalid", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ tool: "not-a-tool", strokeColor: 123, fillColor: "#abcabc", strokeWidth: "wide" })
    );
    const defaults = createDefaultSettings();
    expect(loadSettings()).toEqual({
      tool: defaults.tool, // invalid tool name -> default
      strokeColor: defaults.strokeColor, // non-string -> default
      fillColor: "#abcabc", // valid -> kept
      strokeWidth: defaults.strokeWidth, // non-number -> default
    });
  });

  it("preserves a null fillColor (the 'no fill' state)", () => {
    saveSettings({ tool: "rectangle", strokeColor: "#111", fillColor: null, strokeWidth: 3 });
    expect(loadSettings().fillColor).toBeNull();
  });

  it("swallows a quota-exceeded write error without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    expect(() => saveSettings(custom)).not.toThrow();
  });

  it("uses a versioned key separate from the scene", () => {
    expect(SETTINGS_KEY).toBe("brainstorm:settings:v1");
  });
});
