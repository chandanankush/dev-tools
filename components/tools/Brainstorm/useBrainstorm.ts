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
import { addElement, cloneElements, removeElement, updateElement } from "@/lib/brainstorm/scene";
import { boundingBox, boxesIntersect, hitTest, normalizeShape, resizeShape } from "@/lib/brainstorm/geometry";
import type { Box, ResizeHandle } from "@/lib/brainstorm/geometry";
import { createHistory, pushSnapshot, redo as historyRedo, undo as historyUndo } from "@/lib/brainstorm/history";
import type { History } from "@/lib/brainstorm/history";
import { fromJSON, toJSON, exportPng as exportPngFile } from "@/lib/brainstorm/serialize";
import { loadScene, loadSettings, saveScene, saveSettings } from "@/lib/brainstorm/storage";
import { pan as panViewport, zoomAt as zoomViewportAt } from "@/lib/brainstorm/viewport";
import { createEmptyScene, DEFAULT_STROKE_COLOR, DEFAULT_STROKE_WIDTH } from "@/lib/brainstorm/types";
import type { Element, Scene, ShapeElement, TextElement, ToolName, Viewport } from "@/lib/brainstorm/types";

export type { ToolName };

type Point = { x: number; y: number };

/** How the current selection should be combined with the incoming ids. Only
 * "replace" is wired up today; the other modes exist so shift-click additive
 * selection can be added later without reworking the selection call sites. */
export type SelectionMode = "replace" | "add" | "remove" | "toggle";

type DragState =
  | { kind: "move"; ids: string[]; lastPoint: Point }
  | { kind: "resize"; id: string; handle: ResizeHandle; lastPoint: Point }
  | { kind: "erase" }
  | { kind: "marquee"; start: Point; activated: boolean; rect: Box | null };

const DEBOUNCE_MS = 500;
const RESIZE_HANDLE_SCREEN_PX = 8;
/** Pointer travel (in screen px, converted to world by dividing by zoom) below
 * which a Select-tool drag on empty canvas is treated as a click, not a
 * marquee — prevents accidental marquee rectangles from tiny mouse jitter. */
const DRAG_THRESHOLD_PX = 4;
/** Fixed offset applied to duplicated and pasted elements. */
const PASTE_OFFSET = 10;
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
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);

  const dragRef = useRef<DragState | null>(null);
  const draftOriginRef = useRef<Point | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skips the settings-save effect's initial mount run so the persisted values
  // loaded on mount are never overwritten by the default state they replace.
  const skipFirstSettingsSaveRef = useRef(true);
  // In-memory clipboard for copy/cut/paste — holds deep copies so later edits
  // or deletion of the originals never mutate what will be pasted.
  const clipboardRef = useRef<Element[]>([]);

  function select(ids: string[], mode: SelectionMode = "replace"): void {
    setSelectedIds((prev) => {
      switch (mode) {
        case "replace":
          return ids;
        case "add":
          return Array.from(new Set([...prev, ...ids]));
        case "remove":
          return prev.filter((id) => !ids.includes(id));
        case "toggle": {
          const next = new Set(prev);
          for (const id of ids) (next.has(id) ? next.delete(id) : next.add(id));
          return Array.from(next);
        }
      }
    });
  }

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

  // Load persisted UI settings on mount (client-only, same reason as the scene
  // load above: localStorage is unavailable during SSR).
  useEffect(() => {
    const settings = loadSettings();
    setTool(settings.tool);
    setStrokeColor(settings.strokeColor);
    setFillColor(settings.fillColor);
    setStrokeWidth(settings.strokeWidth);
  }, []);

  // Persist settings on change. The skip-first guard drops the initial mount
  // run — where state still holds defaults — so it can't clobber what the load
  // effect above is about to restore.
  useEffect(() => {
    if (skipFirstSettingsSaveRef.current) {
      skipFirstSettingsSaveRef.current = false;
      return;
    }
    saveSettings({ tool, strokeColor, fillColor, strokeWidth });
  }, [tool, strokeColor, fillColor, strokeWidth]);

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
          if (selectedIds.includes(hit.id)) {
            // Clicked within the existing selection — move the whole group.
            dragRef.current = { kind: "move", ids: selectedIds, lastPoint: point };
          } else {
            select([hit.id], "replace");
            dragRef.current = { kind: "move", ids: [hit.id], lastPoint: point };
          }
        } else {
          // Empty canvas: begin a potential marquee. Selection is left
          // untouched until pointer-up (avoids flicker on a click-through).
          dragRef.current = { kind: "marquee", start: point, activated: false, rect: null };
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

    if (drag.kind === "marquee") {
      const threshold = DRAG_THRESHOLD_PX / viewport.zoom;
      if (!drag.activated && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < threshold) return;
      const rect: Box = {
        x: Math.min(drag.start.x, point.x),
        y: Math.min(drag.start.y, point.y),
        w: Math.abs(point.x - drag.start.x),
        h: Math.abs(point.y - drag.start.y),
      };
      dragRef.current = { ...drag, activated: true, rect };
      setMarquee(rect);
      return;
    }

    if (drag.kind === "move") {
      const dx = point.x - drag.lastPoint.x;
      const dy = point.y - drag.lastPoint.y;
      setLiveScene((prev) => {
        let base = prev ?? history.present;
        for (const id of drag.ids) {
          const el = base.elements.find((e) => e.id === id);
          if (!el) continue;
          const patch: Partial<Element> =
            el.type === "freedraw" ? { points: el.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) } : { x: el.x + dx, y: el.y + dy };
          base = updateElement(base, id, patch);
        }
        return base;
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

    const drag = dragRef.current;
    if (drag?.kind === "marquee") {
      if (drag.activated && drag.rect) {
        // Canonical rule: an element is selected iff its boundingBox intersects
        // the marquee rectangle. Applies uniformly to every element type.
        const rect = drag.rect;
        const hits = scene.elements.filter((el) => boxesIntersect(boundingBox(el), rect));
        select(hits.map((el) => el.id), "replace");
      } else {
        // A click on empty canvas (below the drag threshold) clears selection.
        select([], "replace");
      }
      setMarquee(null);
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

  function selectedElements(): Element[] {
    return scene.elements.filter((el) => selectedIds.includes(el.id));
  }

  /** Adds clones (already offset, with fresh ids) as one history step and makes
   * them the new selection, so the user can immediately drag them away. */
  function addAndSelect(clones: Element[]): void {
    if (clones.length === 0) return;
    setHistory((h) => pushSnapshot(h, clones.reduce((acc, el) => addElement(acc, el), h.present)));
    select(
      clones.map((c) => c.id),
      "replace"
    );
  }

  function duplicateSelection(): void {
    addAndSelect(cloneElements(selectedElements(), PASTE_OFFSET, PASTE_OFFSET));
  }

  function copySelection(): void {
    const selected = selectedElements();
    if (selected.length === 0) return;
    clipboardRef.current = selected.map((el) => structuredClone(el));
  }

  function cutSelection(): void {
    const selected = selectedElements();
    if (selected.length === 0) return;
    clipboardRef.current = selected.map((el) => structuredClone(el));
    setHistory((h) => pushSnapshot(h, selected.reduce((acc, el) => removeElement(acc, el.id), h.present)));
    setSelectedIds([]);
  }

  function paste(): void {
    if (clipboardRef.current.length === 0) return;
    const clones = cloneElements(clipboardRef.current, PASTE_OFFSET, PASTE_OFFSET);
    addAndSelect(clones);
    // Cascade repeated pastes instead of stacking exactly on top of each other.
    clipboardRef.current = clones.map((el) => structuredClone(el));
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

  /**
   * Finalizes a text overlay. `id === null` creates a new element at `point`;
   * a non-null `id` edits an existing element in place — updating just its
   * text (keeping position, seed, colour, and font) or removing it if the
   * user cleared it. Either way it is a single history step.
   */
  function commitText(point: Point, text: string, id: string | null = null): void {
    const trimmed = text.trim();
    if (id !== null) {
      setHistory((h) => pushSnapshot(h, trimmed === "" ? removeElement(h.present, id) : updateElement(h.present, id, { text })));
      return;
    }
    if (trimmed === "") return; // empty new text commits nothing
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

  /** Topmost text element whose bounds contain `point`, or null. Used by the
   * text tool to reopen an existing text for editing instead of stacking a
   * new one on top of it. */
  function textElementAt(point: Point): TextElement | null {
    for (let i = scene.elements.length - 1; i >= 0; i--) {
      const el = scene.elements[i];
      if (el.type === "text" && hitTest(point, el, viewport.zoom)) return el;
    }
    return null;
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
    select,
    marquee,
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
    copySelection,
    cutSelection,
    paste,
    clear,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    commitText,
    textElementAt,
    panBy,
    zoomAtCursor,
    exportPngBlob,
    exportJsonText,
    importJsonText,
    selectionBoundingBox,
  };
}
