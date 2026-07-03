import { describe, it, expect } from "vitest";
import { toJSON, fromJSON } from "@/lib/brainstorm/serialize";
import { createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { ShapeElement, FreedrawElement, TextElement } from "@/lib/brainstorm/types";

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

describe("toJSON / fromJSON", () => {
  it("round-trips a populated scene", () => {
    const scene = addElement(createEmptyScene(), rect);
    const result = fromJSON(toJSON(scene));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene).toEqual(scene);
  });

  it("round-trips a scene with every element type", () => {
    const freedraw: FreedrawElement = {
      id: "f1",
      type: "freedraw",
      points: [
        [0, 0],
        [1, 1],
      ],
      strokeColor: "#111",
      strokeWidth: 1,
      seed: 2,
    };
    const text: TextElement = {
      id: "t1",
      type: "text",
      x: 1,
      y: 2,
      text: "hi",
      fontSize: 16,
      strokeColor: "#222",
      strokeWidth: 1,
      seed: 3,
    };
    let scene = addElement(createEmptyScene(), rect);
    scene = addElement(scene, freedraw);
    scene = addElement(scene, text);
    const result = fromJSON(toJSON(scene));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene).toEqual(scene);
  });

  it("rejects invalid JSON text", () => {
    expect(fromJSON("{not json").ok).toBe(false);
  });

  it("rejects a missing version field", () => {
    expect(fromJSON(JSON.stringify({ elements: [] })).ok).toBe(false);
  });

  it("rejects an unsupported version number", () => {
    expect(fromJSON(JSON.stringify({ version: 2, elements: [] })).ok).toBe(false);
  });

  it("rejects a top-level value that isn't an object", () => {
    expect(fromJSON(JSON.stringify([1, 2, 3])).ok).toBe(false);
    expect(fromJSON(JSON.stringify("nope")).ok).toBe(false);
  });

  it("rejects an element missing required base fields", () => {
    expect(fromJSON(JSON.stringify({ version: 1, elements: [{ type: "rectangle" }] })).ok).toBe(false);
  });

  it("rejects an element with an unknown type", () => {
    const bad = { id: "x", strokeColor: "#000", strokeWidth: 1, seed: 1, type: "triangle" };
    expect(fromJSON(JSON.stringify({ version: 1, elements: [bad] })).ok).toBe(false);
  });

  it("rejects a non-array elements field", () => {
    expect(fromJSON(JSON.stringify({ version: 1, elements: "nope" })).ok).toBe(false);
  });

  it("accepts an empty scene", () => {
    const result = fromJSON(toJSON(createEmptyScene()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene.elements).toEqual([]);
  });
});
