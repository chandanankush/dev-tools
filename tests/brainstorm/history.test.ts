import { describe, it, expect } from "vitest";
import { createHistory, pushSnapshot, undo, redo } from "@/lib/brainstorm/history";
import { createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { ShapeElement } from "@/lib/brainstorm/types";

const rect = (id: string): ShapeElement => ({
  id,
  type: "rectangle",
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  strokeColor: "#000",
  strokeWidth: 1,
  fillColor: null,
  seed: 1,
});

describe("history", () => {
  it("undo returns the previous scene; redo replays it forward", () => {
    let h = createHistory(createEmptyScene());
    const s1 = addElement(createEmptyScene(), rect("a"));
    h = pushSnapshot(h, s1);
    const s2 = addElement(s1, rect("b"));
    h = pushSnapshot(h, s2);

    const afterUndo = undo(h);
    expect(afterUndo.scene).toEqual(s1);

    const afterRedo = redo(afterUndo.history);
    expect(afterRedo.scene).toEqual(s2);
  });

  it("undo on an empty past is a no-op returning the current scene", () => {
    const h = createHistory(createEmptyScene());
    const result = undo(h);
    expect(result.scene).toEqual(createEmptyScene());
    expect(result.history).toEqual(h);
  });

  it("redo on an empty future is a no-op", () => {
    const h = createHistory(createEmptyScene());
    const result = redo(h);
    expect(result.scene).toEqual(createEmptyScene());
    expect(result.history).toEqual(h);
  });

  it("pushing a new snapshot clears the redo future", () => {
    let h = createHistory(createEmptyScene());
    h = pushSnapshot(h, addElement(createEmptyScene(), rect("a")));
    const afterUndo = undo(h);
    const afterPush = pushSnapshot(afterUndo.history, addElement(createEmptyScene(), rect("c")));
    expect(afterPush.future).toEqual([]);
    const afterRedo = redo(afterPush);
    // redo is a no-op now — the future was discarded by the new push
    expect(afterRedo.scene).toEqual(afterPush.present);
  });

  it("multiple undos walk back through several snapshots in order", () => {
    let h = createHistory(createEmptyScene());
    const s1 = addElement(createEmptyScene(), rect("a"));
    const s2 = addElement(s1, rect("b"));
    const s3 = addElement(s2, rect("c"));
    h = pushSnapshot(h, s1);
    h = pushSnapshot(h, s2);
    h = pushSnapshot(h, s3);

    const u1 = undo(h);
    expect(u1.scene).toEqual(s2);
    const u2 = undo(u1.history);
    expect(u2.scene).toEqual(s1);
    const u3 = undo(u2.history);
    expect(u3.scene).toEqual(createEmptyScene());
  });

  it("bounds the undo stack to a fixed maximum (does not grow unbounded)", () => {
    let h = createHistory(createEmptyScene());
    for (let i = 0; i < 200; i++) {
      h = pushSnapshot(h, addElement(createEmptyScene(), rect(`r${i}`)));
    }
    expect(h.past.length).toBeLessThanOrEqual(100);
  });
});
