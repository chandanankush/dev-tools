import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBrainstorm } from "@/components/tools/Brainstorm/useBrainstorm";
import { loadScene, loadSettings, saveScene, saveSettings, STORAGE_KEY } from "@/lib/brainstorm/storage";
import { addElement } from "@/lib/brainstorm/scene";
import { createEmptyScene } from "@/lib/brainstorm/types";
import type { ShapeElement } from "@/lib/brainstorm/types";

// Every handler call gets its own act() — calling handlePointerDown/Move/Up
// back-to-back inside a single act() would invoke three STALE closures from
// the same pre-update render (setDraftElement/setHistory are batched, so
// `draftElement`/`history` inside that one render's closures never reflect
// each other's updates). Real DOM pointer events are separate browser
// events with a React re-render in between each, which is what separate
// act() calls per call faithfully reproduces.

beforeEach(() => {
  localStorage.clear();
});

describe("useBrainstorm persistence", () => {
  it("debounces saves and persists the scene to localStorage after the delay", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBrainstorm());

    act(() => result.current.setTool("rectangle"));
    act(() => result.current.handlePointerDown({ x: 0, y: 0 }));
    act(() => result.current.handlePointerMove({ x: 50, y: 50 }));
    act(() => result.current.handlePointerUp());

    expect(result.current.scene.elements).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull(); // not yet — debounced
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(loadScene().elements).toHaveLength(1);
    vi.useRealTimers();
  });

  it("loads a previously saved scene on mount", async () => {
    const rect: ShapeElement = {
      id: "preexisting",
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
    saveScene(addElement(createEmptyScene(), rect));

    const { result } = renderHook(() => useBrainstorm());
    await waitFor(() => expect(result.current.scene.elements).toHaveLength(1));
    expect(result.current.scene.elements[0].id).toBe("preexisting");
  });

  it("persists drawing settings (tool, colours, width) as they change", async () => {
    const { result } = renderHook(() => useBrainstorm());

    act(() => result.current.setTool("pen"));
    act(() => result.current.setStrokeColor("#ff0000"));
    act(() => result.current.setFillColor("#00ff00"));
    act(() => result.current.setStrokeWidth(6));

    await waitFor(() =>
      expect(loadSettings()).toEqual({ tool: "pen", strokeColor: "#ff0000", fillColor: "#00ff00", strokeWidth: 6 })
    );
  });

  it("restores previously saved settings on mount (survives a refresh)", async () => {
    saveSettings({ tool: "ellipse", strokeColor: "#123456", fillColor: null, strokeWidth: 9 });

    const { result } = renderHook(() => useBrainstorm());

    await waitFor(() => expect(result.current.tool).toBe("ellipse"));
    expect(result.current.strokeColor).toBe("#123456");
    expect(result.current.fillColor).toBeNull();
    expect(result.current.strokeWidth).toBe(9);
  });

  it("does not clobber stored settings with defaults on mount", async () => {
    saveSettings({ tool: "arrow", strokeColor: "#abcdef", fillColor: null, strokeWidth: 4 });

    renderHook(() => useBrainstorm());

    // Give the mount load + save effects time to run; stored value must remain.
    await waitFor(() => expect(loadSettings().tool).toBe("arrow"));
    expect(loadSettings().strokeColor).toBe("#abcdef");
  });
});

describe("useBrainstorm drawing and history", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function drawRectangle(result: { current: ReturnType<typeof useBrainstorm> }, from: { x: number; y: number }, to: { x: number; y: number }) {
    act(() => result.current.setTool("rectangle"));
    act(() => result.current.handlePointerDown(from));
    act(() => result.current.handlePointerMove(to));
    act(() => result.current.handlePointerUp());
  }

  it("committing a rectangle drag adds exactly one element and one undo step", () => {
    const { result } = renderHook(() => useBrainstorm());
    drawRectangle(result, { x: 0, y: 0 }, { x: 40, y: 30 });
    expect(result.current.scene.elements).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.scene.elements).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.scene.elements).toHaveLength(1);
  });

  it("a click without drag does not commit a degenerate zero-size shape", () => {
    const { result } = renderHook(() => useBrainstorm());
    act(() => result.current.setTool("rectangle"));
    act(() => result.current.handlePointerDown({ x: 10, y: 10 }));
    act(() => result.current.handlePointerUp());
    expect(result.current.scene.elements).toHaveLength(0);
  });

  it("normalizes a rectangle drawn up-and-left into positive w/h on commit", () => {
    const { result } = renderHook(() => useBrainstorm());
    drawRectangle(result, { x: 20, y: 20 }, { x: 0, y: 0 });
    const el = result.current.scene.elements[0] as ShapeElement;
    expect(el.w).toBeGreaterThan(0);
    expect(el.h).toBeGreaterThan(0);
    expect(el.x).toBe(0);
    expect(el.y).toBe(0);
  });

  it("pen drag commits a freedraw element with all moved-through points", () => {
    const { result } = renderHook(() => useBrainstorm());
    act(() => result.current.setTool("pen"));
    act(() => result.current.handlePointerDown({ x: 0, y: 0 }));
    act(() => result.current.handlePointerMove({ x: 5, y: 5 }));
    act(() => result.current.handlePointerMove({ x: 10, y: 0 }));
    act(() => result.current.handlePointerUp());
    expect(result.current.scene.elements).toHaveLength(1);
    const el = result.current.scene.elements[0] as { points: [number, number][] };
    expect(el.points).toHaveLength(3);
  });

  it("select tool: clicking an element selects it; dragging moves it as one undo step", () => {
    const { result } = renderHook(() => useBrainstorm());
    drawRectangle(result, { x: 0, y: 0 }, { x: 10, y: 10 });

    act(() => result.current.setTool("select"));
    act(() => result.current.handlePointerDown({ x: 5, y: 5 }));
    expect(result.current.selectedIds).toHaveLength(1);
    expect(result.current.canUndo).toBe(true); // the draw was already one undo step

    act(() => result.current.handlePointerMove({ x: 15, y: 15 }));
    act(() => result.current.handlePointerMove({ x: 25, y: 25 }));
    act(() => result.current.handlePointerUp());

    const moved = result.current.scene.elements[0] as ShapeElement;
    expect(moved.x).toBeGreaterThan(0);

    act(() => result.current.undo()); // undoes the move in one step
    const afterUndo = result.current.scene.elements[0] as ShapeElement;
    expect(afterUndo.x).toBe(0); // back to where it was originally drawn
  });

  it("resize via a corner handle keeps the opposite corner fixed", () => {
    const { result } = renderHook(() => useBrainstorm());
    drawRectangle(result, { x: 0, y: 0 }, { x: 10, y: 10 });

    act(() => result.current.setTool("select"));
    act(() => result.current.handlePointerDown({ x: 5, y: 5 })); // selects it
    act(() => result.current.handlePointerUp());

    // The se handle sits at world (10, 10) given zoom 1 (default), well
    // within the resize-handle hit tolerance.
    act(() => result.current.handlePointerDown({ x: 10, y: 10 }));
    act(() => result.current.handlePointerMove({ x: 20, y: 20 }));
    act(() => result.current.handlePointerUp());

    const resized = result.current.scene.elements[0] as ShapeElement;
    expect(resized.x).toBe(0);
    expect(resized.y).toBe(0);
    expect(resized.w).toBeCloseTo(20);
    expect(resized.h).toBeCloseTo(20);
  });

  it("eraser drag over multiple elements removes them all in a single undo step", () => {
    const { result } = renderHook(() => useBrainstorm());
    drawRectangle(result, { x: 0, y: 0 }, { x: 5, y: 5 });
    drawRectangle(result, { x: 20, y: 20 }, { x: 25, y: 25 });
    expect(result.current.scene.elements).toHaveLength(2);

    act(() => result.current.setTool("eraser"));
    act(() => result.current.handlePointerDown({ x: 2, y: 2 }));
    act(() => result.current.handlePointerMove({ x: 22, y: 22 }));
    act(() => result.current.handlePointerUp());

    expect(result.current.scene.elements).toHaveLength(0);
    act(() => result.current.undo());
    expect(result.current.scene.elements).toHaveLength(2); // both restored by one undo
  });

  it("duplicateSelection clones the selected element with an offset", () => {
    const { result } = renderHook(() => useBrainstorm());
    drawRectangle(result, { x: 0, y: 0 }, { x: 10, y: 10 });
    act(() => result.current.setTool("select"));
    act(() => result.current.handlePointerDown({ x: 5, y: 5 }));
    act(() => result.current.handlePointerUp());
    act(() => result.current.duplicateSelection());
    expect(result.current.scene.elements).toHaveLength(2);
  });

  it("deleteSelection removes the selected element", () => {
    const { result } = renderHook(() => useBrainstorm());
    drawRectangle(result, { x: 0, y: 0 }, { x: 10, y: 10 });
    act(() => result.current.setTool("select"));
    act(() => result.current.handlePointerDown({ x: 5, y: 5 }));
    act(() => result.current.handlePointerUp());
    act(() => result.current.deleteSelection());
    expect(result.current.scene.elements).toHaveLength(0);
  });

  it("commitText adds a text element but ignores an empty/whitespace-only commit", () => {
    const { result } = renderHook(() => useBrainstorm());
    act(() => result.current.commitText({ x: 1, y: 1 }, "   "));
    expect(result.current.scene.elements).toHaveLength(0);
    act(() => result.current.commitText({ x: 1, y: 1 }, "hello"));
    expect(result.current.scene.elements).toHaveLength(1);
  });

  it("exportJsonText / importJsonText round-trips the scene", () => {
    const { result } = renderHook(() => useBrainstorm());
    drawRectangle(result, { x: 0, y: 0 }, { x: 10, y: 10 });
    const exported = result.current.exportJsonText();
    act(() => result.current.clear());
    expect(result.current.scene.elements).toHaveLength(0);

    let importResult: { ok: boolean; error?: string } = { ok: false };
    act(() => {
      importResult = result.current.importJsonText(exported);
    });
    expect(importResult.ok).toBe(true);
    expect(result.current.scene.elements).toHaveLength(1);
  });

  it("importJsonText rejects malformed JSON without throwing or mutating the scene", () => {
    const { result } = renderHook(() => useBrainstorm());
    let importResult: { ok: boolean; error?: string } = { ok: true };
    act(() => {
      importResult = result.current.importJsonText("{not json");
    });
    expect(importResult.ok).toBe(false);
    expect(result.current.scene.elements).toHaveLength(0);
  });
});
