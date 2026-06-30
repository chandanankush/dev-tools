import { describe, it, expect } from "vitest";
import { addElement, updateElement, removeElement, duplicateElement } from "@/lib/brainstorm/scene";
import { createEmptyScene } from "@/lib/brainstorm/types";
import type { ShapeElement, FreedrawElement } from "@/lib/brainstorm/types";

const rect: ShapeElement = {
  id: "rect-1",
  type: "rectangle",
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  strokeColor: "#000",
  strokeWidth: 1,
  fillColor: null,
  seed: 1,
};

describe("addElement", () => {
  it("appends the element without mutating the input scene", () => {
    const scene = createEmptyScene();
    const next = addElement(scene, rect);
    expect(scene.elements).toHaveLength(0);
    expect(next.elements).toEqual([rect]);
  });
});

describe("updateElement", () => {
  it("merges a partial patch into the matching element by id", () => {
    const scene = addElement(createEmptyScene(), rect);
    const next = updateElement(scene, "rect-1", { w: 99 });
    expect(next.elements[0]).toEqual({ ...rect, w: 99 });
  });

  it("is a no-op for an unknown id", () => {
    const scene = addElement(createEmptyScene(), rect);
    const next = updateElement(scene, "nope", { w: 99 });
    expect(next).toEqual(scene);
  });
});

describe("removeElement", () => {
  it("removes the element with the matching id", () => {
    const scene = addElement(createEmptyScene(), rect);
    expect(removeElement(scene, "rect-1").elements).toHaveLength(0);
  });

  it("is a no-op for an unknown id", () => {
    const scene = addElement(createEmptyScene(), rect);
    expect(removeElement(scene, "nope")).toEqual(scene);
  });
});

describe("duplicateElement", () => {
  it("clones a shape element with a new id and an offset position", () => {
    const scene = addElement(createEmptyScene(), rect);
    const next = duplicateElement(scene, "rect-1");
    expect(next.elements).toHaveLength(2);
    const clone = next.elements[1] as ShapeElement;
    expect(clone.id).not.toBe("rect-1");
    expect(clone.x).toBeGreaterThan(rect.x);
    expect(clone.y).toBeGreaterThan(rect.y);
    expect(clone.w).toBe(rect.w);
    expect(clone.h).toBe(rect.h);
  });

  it("clones a freedraw element with offset points", () => {
    const freedraw: FreedrawElement = {
      id: "fd-1",
      type: "freedraw",
      points: [
        [0, 0],
        [5, 5],
      ],
      strokeColor: "#000",
      strokeWidth: 1,
      seed: 2,
    };
    const scene = addElement(createEmptyScene(), freedraw);
    const next = duplicateElement(scene, "fd-1");
    const clone = next.elements[1] as FreedrawElement;
    expect(clone.id).not.toBe("fd-1");
    expect(clone.points[0][0]).toBeGreaterThan(freedraw.points[0][0]);
    expect(clone.points[0][1]).toBeGreaterThan(freedraw.points[0][1]);
    expect(clone.points[1][0]).toBeGreaterThan(freedraw.points[1][0]);
  });

  it("is a no-op for an unknown id", () => {
    const scene = addElement(createEmptyScene(), rect);
    expect(duplicateElement(scene, "nope")).toEqual(scene);
  });
});
