/**
 * useBrainstorm — the integration point between the pure lib/brainstorm/*
 * modules and the canvas component. Owns scene/history/viewport/tool state
 * and all pointer/keyboard-triggered mutation; the component layer
 * (index.tsx, Toolbar.tsx) only renders this state and forwards raw
 * input events, with no geometry math of its own.
 *
 * Two kinds of "in progress, not yet in history" state, kept deliberately
 * separate:
 *  - `draftElement`: a brand-new element being drawn (pen/shape tools) that
 *    doesn't exist in the scene at all until pointer-up commits it.
 *  - `liveScene`: a full scene override used while moving/resizing an
 *    *existing* element or erasing — `scene` (the rendered value) falls back
 *    to `history.present` whenever no such drag is active.
 * Both exist specifically so that pointer-move ticks during a single drag
 * never push history snapshots — only pointer-up does, so one drag is one
 * undo step (matching the governing rule documented in the implementation
 * plan), including for the eraser, which otherwise would push one snapshot
 * per erased element.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { addElement, duplicateElement, removeElement, updateElement } from "@/lib/brainstorm/scene";
import { boundingBox, hitTest, normalizeShape, resizeShape } from "@/lib/brainstorm/geometry";
import type { ResizeHandle } from "@/lib/brainstorm/geometry";
import { createHistory, pushSnapshot, redo as historyRedo, undo as historyUndo } from "@/lib/brainstorm/history";
import type { History } from "@/lib/brainstorm/history";
import { fromJSON, toJSON, exportPng as exportPngFile } from "@/lib/brainstorm/serialize";
import { loadScene, saveScene } from "@/lib/brainstorm/storage";
import { pan as panViewport, zoomAt as zoomViewportAt } from "@/lib/brainstorm/viewport";
import { createEmptyScene } from "@/lib/brainstorm/types";
import type { Element, Scene, ShapeElement, TextElement, Viewport } from "@/lib/brainstorm/types";

export type ToolName = "select" | "pen" | "rectangle" | "ellipse" | "line" | "arrow" | "text" | "eraser";

type Point = { x: number; y: number };

type DragState =
  | { kind: "move"; id: string; lastPoint: Point }
  | { kind: "resize"; id: string; handle: ResizeHandle; lastPoint: Point }
  | { kind: "erase" };

const DEBOUNCE_MS = 500;
const RESIZE_HANDLE_SCREEN_PX = 8;
const DEFAULT_STROKE_COLOR = "#1e1e1e";
const DEFAULT_STROKE_WIDTH = 2;
/** Exported so index.tsx's text-overlay textarea can size its font to match
 * exactly what commitText below will bake into the committed TextElement. */
export const TEXT_FONT_SIZE = 20;
const DEFAULT_VIEWPORT: Viewport = { scrollX: 0, scrollY: 0, zoom: 1 };

function isShapeElement(el: Element): el is ShapeElement {
  return el.type === "rectangle" || el.type === "ellipse" || el.type === "line" || el.type === "arrow";
}

function isDrawShapeTool(tool: ToolName): tool is "rectangle" | "ellipse" | "line" | "arrow" {
  return tool === "rectangle" || tool === "ellipse" || tool === "line" || tool === "arrow";
}

/** Raw crypto-random uint32, used directly with no modulo — a roughjs seed
 * has no bounded range to be biased within, so rejection sampling isn't
 * needed (unlike a bounded random index, which would need it). */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function hitTestResizeHandle(point: Point, el: ShapeElement, zoom: number): ResizeHandle | null {
  const tolerance = RESIZE_HANDLE_SCREEN_PX / zoom;
  const candidates: { handle: ResizeHandle; point: Point }[] =
    el.type === "line" || el.type === "arrow"
      ? [
          { handle: "nw", point: { x: el.x, y: el.y } }, // start point
          { handle: "se", point: { x: el.x + el.w, y: el.y + el.h } }, // end point
        ]
      : [
          { handle: "nw", point: { x: el.x, y: el.y } },
          { handle: "ne", point: { x: el.x + el.w, y: el.y } },
          { handle: "sw", point: { x: el.x, y: el.y + el.h } },
          { handle: "se", point: { x: el.x + el.w, y: el.y + el.h } },
        ];
  for (const candidate of candidates) {
    if (Math.hypot(point.x - candidate.point.x, point.y - candidate.point.y) <= tolerance) return candidate.handle;
  }
  return null;
}

export function useBrainstorm() {
  const [history, setHistory] = useState<History>(() => createHistory(createEmptyScene()));
  const [liveScene, setLiveScene] = useState<Scene | null>(null);
  const [draftElement, setDraftElement] = useState<Element | null>(null);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [tool, setTool] = useState<ToolName>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);

  const dragRef = useRef<DragState | null>(null);
  const draftOriginRef = useRef<Point | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-only localStorage load — done in an effect (not a useState lazy
  // initializer) because this component can be server-rendered, and
  // `localStorage` doesn't exist during SSR. Matches the precedent in
  // EditorPad.tsx/WeightPriceCalculator.tsx, which load the same way.
  useEffect(() => {
    setHistory(createHistory(loadScene()));
  }, []);

  // Debounced auto-save, matching EditorPad.tsx's pattern exactly: a
  // useRef timer, reset on every change, cleared on unmount. Tied to
  // history.present only — liveScene/draftElement are in-progress and never
  // persisted mid-drag.
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveScene(history.present);
    }, DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [history.present]);

  const scene = liveScene ?? history.present;

  function eraseAt(point: Point, base: Scene): Scene {
    const hits = base.elements.filter((el) => hitTest(point, el, viewport.zoom));
    if (hits.length === 0) return base;
    return hits.reduce((acc, el) => removeElement(acc, el.id), base);
  }

  function handlePointerDown(point: Point): void {
    switch (tool) {
      case "select": {
        if (selectedIds.length === 1) {
          const selected = scene.elements.find((el) => el.id === selectedIds[0]);
          if (selected && isShapeElement(selected)) {
            const handle = hitTestResizeHandle(point, selected, viewport.zoom);
            if (handle) {
              dragRef.current = { kind: "resize", id: selected.id, handle, lastPoint: point };
              return;
            }
          }
        }
        const hit = [...scene.elements].reverse().find((el) => hitTest(point, el, viewport.zoom));
        if (hit) {
          setSelectedIds([hit.id]);
          dragRef.current = { kind: "move", id: hit.id, lastPoint: point };
        } else {
          setSelectedIds([]);
          dragRef.current = null;
        }
        return;
      }
      case "pen":
        setDraftElement({
          id: crypto.randomUUID(),
          type: "freedraw",
          points: [[point.x, point.y]],
          strokeColor,
          strokeWidth,
          seed: randomSeed(),
        });
        return;
      case "rectangle":
      case "ellipse":
      case "line":
      case "arrow":
        draftOriginRef.current = point;
        setDraftElement({
          id: crypto.randomUUID(),
          type: tool,
          x: point.x,
          y: point.y,
          w: 0,
          h: 0,
          strokeColor,
          strokeWidth,
          fillColor,
          seed: randomSeed(),
        });
        return;
      case "eraser":
        dragRef.current = { kind: "erase" };
        setLiveScene(eraseAt(point, history.present));
        return;
      case "text":
        // The text tool's click-to-place caret and textarea overlay are a
        // DOM-positioning concern owned by index.tsx (it calls commitText
        // below once the overlay textarea blurs) — there's nothing for a
        // pointer-down to do at this layer.
        return;
    }
  }

  function handlePointerMove(point: Point): void {
    if (draftElement) {
      if (draftElement.type === "freedraw") {
        setDraftElement({ ...draftElement, points: [...draftElement.points, [point.x, point.y]] });
      } else if (isDrawShapeTool(tool) && draftOriginRef.current) {
        const origin = draftOriginRef.current;
        setDraftElement({ ...(draftElement as ShapeElement), w: point.x - origin.x, h: point.y - origin.y });
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === "erase") {
      setLiveScene((prev) => eraseAt(point, prev ?? history.present));
      return;
    }

    if (drag.kind === "move") {
      const dx = point.x - drag.lastPoint.x;
      const dy = point.y - drag.lastPoint.y;
      setLiveScene((prev) => {
        const base = prev ?? history.present;
        const el = base.elements.find((e) => e.id === drag.id);
        if (!el) return base;
        const patch: Partial<Element> =
          el.type === "freedraw" ? { points: el.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) } : { x: el.x + dx, y: el.y + dy };
        return updateElement(base, drag.id, patch);
      });
      dragRef.current = { ...drag, lastPoint: point };
      return;
    }

    if (drag.kind === "resize") {
      const dx = point.x - drag.lastPoint.x;
      const dy = point.y - drag.lastPoint.y;
      setLiveScene((prev) => {
        const base = prev ?? history.present;
        const el = base.elements.find((e) => e.id === drag.id);
        if (!el || !isShapeElement(el)) return base;
        return updateElement(base, drag.id, resizeShape(el, drag.handle, dx, dy));
      });
      dragRef.current = { ...drag, lastPoint: point };
    }
  }

  function handlePointerUp(): void {
    if (draftElement) {
      const committed = isShapeElement(draftElement) ? normalizeShape(draftElement) : draftElement;
      const isDegenerateShape = isShapeElement(committed) && committed.w === 0 && committed.h === 0;
      if (!isDegenerateShape) {
        setHistory((h) => pushSnapshot(h, addElement(h.present, committed)));
      }
      setDraftElement(null);
      draftOriginRef.current = null;
      dragRef.current = null;
      return;
    }

    if (liveScene) {
      setHistory((h) => pushSnapshot(h, liveScene));
      setLiveScene(null);
    }
    dragRef.current = null;
  }

  function undo(): void {
    const result = historyUndo(history);
    setHistory(result.history);
    setSelectedIds([]);
  }

  function redo(): void {
    const result = historyRedo(history);
    setHistory(result.history);
    setSelectedIds([]);
  }

  function duplicateSelection(): void {
    if (selectedIds.length !== 1) return;
    setHistory((h) => pushSnapshot(h, duplicateElement(h.present, selectedIds[0])));
  }

  function deleteSelection(): void {
    if (selectedIds.length === 0) return;
    setHistory((h) => pushSnapshot(h, selectedIds.reduce((acc, id) => removeElement(acc, id), h.present)));
    setSelectedIds([]);
  }

  function clear(): void {
    setHistory((h) => pushSnapshot(h, createEmptyScene()));
    setSelectedIds([]);
  }

  function commitText(point: Point, text: string): void {
    if (text.trim() === "") return; // empty textarea on blur commits nothing
    const element: TextElement = {
      id: crypto.randomUUID(),
      type: "text",
      x: point.x,
      y: point.y,
      text,
      fontSize: TEXT_FONT_SIZE,
      strokeColor,
      strokeWidth: 1,
      seed: randomSeed(),
    };
    setHistory((h) => pushSnapshot(h, addElement(h.present, element)));
  }

  function panBy(delta: { dx: number; dy: number }): void {
    setViewport((vp) => panViewport(vp, delta));
  }

  function zoomAtCursor(cursor: Point, delta: number): void {
    setViewport((vp) => zoomViewportAt(vp, cursor, delta));
  }

  function exportPngBlob(): Promise<Blob> {
    return exportPngFile(scene);
  }

  function exportJsonText(): string {
    return toJSON(scene);
  }

  function importJsonText(text: string): { ok: boolean; error?: string } {
    const result = fromJSON(text);
    if (!result.ok) return { ok: false, error: result.error };
    setHistory((h) => pushSnapshot(h, result.scene));
    setSelectedIds([]);
    return { ok: true };
  }

  function selectionBoundingBox() {
    if (selectedIds.length !== 1) return null;
    const el = scene.elements.find((e) => e.id === selectedIds[0]);
    return el ? boundingBox(el) : null;
  }

  return {
    scene,
    draftElement,
    viewport,
    tool,
    setTool,
    selectedIds,
    strokeColor,
    setStrokeColor,
    fillColor,
    setFillColor,
    strokeWidth,
    setStrokeWidth,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo,
    redo,
    duplicateSelection,
    deleteSelection,
    clear,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    commitText,
    panBy,
    zoomAtCursor,
    exportPngBlob,
    exportJsonText,
    importJsonText,
    selectionBoundingBox,
  };
}
