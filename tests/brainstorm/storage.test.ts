import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveScene, loadScene, STORAGE_KEY } from "@/lib/brainstorm/storage";
import { createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { ShapeElement } from "@/lib/brainstorm/types";

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
