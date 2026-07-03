/**
 * Brainstorm — orchestration component. Owns the canvas ref, the
 * device-pixel-ratio-aware sizing, the persistent requestAnimationFrame
 * render loop, and all DOM event wiring (pointer/keyboard/wheel). All scene
 * decisions are delegated to useBrainstorm; this component contains no
 * geometry math beyond screen<->world conversion via lib/brainstorm/viewport.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { createDrawableCache, drawScene } from "@/lib/brainstorm/render";
import { boundingBox } from "@/lib/brainstorm/geometry";
import { screenToWorld, worldToScreen } from "@/lib/brainstorm/viewport";
import type { Scene } from "@/lib/brainstorm/types";
import { Toolbar } from "./Toolbar";
import { useBrainstorm, TEXT_FONT_SIZE } from "./useBrainstorm";

const ZOOM_STEP = 0.1;

function isTypingInFormField(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

export default function Brainstorm() {
  const brainstorm = useBrainstorm();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const spaceHeldRef = useRef(false);
  // The active text overlay. `id` is the existing element being edited, or
  // null when creating a new one; `world` is its top-left in world space.
  const [textEditor, setTextEditor] = useState<{
    world: { x: number; y: number };
    id: string | null;
    initialText: string;
    color: string;
  } | null>(null);
  // Guards against the trailing blur that fires when the overlay unmounts (on
  // commit or discard) re-running the commit a second time.
  const closingTextRef = useRef(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Refs mirroring the latest render's state, read by the persistent rAF
  // loop below — refs (not closures) so the loop never needs to restart
  // when state changes, and a single dirty flag avoids redrawing every idle
  // animation frame.
  const sceneRef = useRef<Scene>(brainstorm.scene);
  const draftRef = useRef(brainstorm.draftElement);
  const viewportRef = useRef(brainstorm.viewport);
  const selectedIdsRef = useRef(brainstorm.selectedIds);
  // Id of the text element currently being edited — hidden from the canvas
  // render loop below so its overlay textarea isn't drawn on top of a
  // duplicate of itself.
  const editingIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(true);

  useEffect(() => {
    sceneRef.current = brainstorm.scene;
    draftRef.current = brainstorm.draftElement;
    viewportRef.current = brainstorm.viewport;
    selectedIdsRef.current = brainstorm.selectedIds;
    dirtyRef.current = true;
  }, [brainstorm.scene, brainstorm.draftElement, brainstorm.viewport, brainstorm.selectedIds]);

  // Canvas backing-store sizing: kept in step with the container's CSS size
  // at the current devicePixelRatio so strokes stay crisp on high-DPI
  // displays. Resizing a canvas element resets its transform, so the next
  // frame's ctx.scale(dpr, dpr) (in the render loop below) always re-applies
  // cleanly.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = Math.max(1, Math.round(rect.width * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      dirtyRef.current = true;
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Persistent render loop — started once on mount, never restarted. The
  // drawable cache lives here (one instance for the component's lifetime)
  // so roughjs drawables survive across pan/zoom frames.
  useEffect(() => {
    const cache = createDrawableCache();
    let rafId: number;

    function frame() {
      if (dirtyRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const current = sceneRef.current;
          const draft = draftRef.current;
          const editingId = editingIdRef.current;
          const visible = editingId ? current.elements.filter((el) => el.id !== editingId) : current.elements;
          const renderScene: Scene = draft ? { ...current, elements: [...visible, draft] } : { ...current, elements: visible };
          ctx.save();
          ctx.scale(dpr, dpr);
          drawScene(ctx, renderScene, viewportRef.current, cache);
          drawSelectionOverlay(ctx, current, selectedIdsRef.current, viewportRef.current);
          ctx.restore();
        }
        dirtyRef.current = false;
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Keyboard shortcuts. Re-subscribed on every render since `brainstorm`'s
  // handlers aren't memoized — cheap (a handful of listeners), traded for
  // not needing useCallback everywhere in the hook.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === " ") spaceHeldRef.current = true;
      if (isTypingInFormField()) return; // let text/number inputs handle their own keys
      const isMod = e.metaKey || e.ctrlKey;
      if ((e.key === "Delete" || e.key === "Backspace") && brainstorm.selectedIds.length > 0) {
        e.preventDefault();
        brainstorm.deleteSelection();
      } else if (isMod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        brainstorm.duplicateSelection();
      } else if (isMod && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        brainstorm.redo();
      } else if (isMod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        brainstorm.undo();
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === " ") spaceHeldRef.current = false;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  // Wheel: Ctrl/Cmd + wheel zooms the board, plain wheel pans. Registered as
  // a *non-passive* native listener (not React's onWheel, which is always
  // passive) so preventDefault() actually suppresses the browser's own
  // Ctrl/Cmd + wheel page zoom — otherwise both the board and the whole page
  // zoom at once. Re-subscribed every render since brainstorm's handlers
  // aren't memoized, matching the keyboard effect above.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const screenPoint = getCanvasPoint(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        brainstorm.zoomAtCursor(screenPoint, -e.deltaY * 0.01);
      } else {
        brainstorm.panBy({ dx: -e.deltaX, dy: -e.deltaY });
      }
    }
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  });

  useEffect(() => {
    editingIdRef.current = textEditor?.id ?? null;
    dirtyRef.current = true;
    if (!textEditor) return;
    closingTextRef.current = false;
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    }
  }, [textEditor]);

  function getCanvasPoint(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    if (e.button === 1 || spaceHeldRef.current) {
      panRef.current = { lastX: e.clientX, lastY: e.clientY };
      return;
    }

    const screenPoint = getCanvasPoint(e.clientX, e.clientY);
    if (brainstorm.tool === "text") {
      // A click while editing only finalizes the current text in place — it
      // never repositions it or opens a new box at the click point.
      if (textEditor) {
        commitTextOverlay();
        return;
      }
      const world = screenToWorld(screenPoint, brainstorm.viewport);
      const existing = brainstorm.textElementAt(world);
      if (existing) {
        setTextEditor({ world: { x: existing.x, y: existing.y }, id: existing.id, initialText: existing.text, color: existing.strokeColor });
      } else {
        setTextEditor({ world, id: null, initialText: "", color: brainstorm.strokeColor });
      }
      return;
    }
    brainstorm.handlePointerDown(screenToWorld(screenPoint, brainstorm.viewport));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.lastX;
      const dy = e.clientY - panRef.current.lastY;
      panRef.current = { lastX: e.clientX, lastY: e.clientY };
      brainstorm.panBy({ dx, dy });
      return;
    }
    const screenPoint = getCanvasPoint(e.clientX, e.clientY);
    brainstorm.handlePointerMove(screenToWorld(screenPoint, brainstorm.viewport));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    brainstorm.handlePointerUp();
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  // The canvas is not focusable, so a mousedown on it moves focus to <body>.
  // With the text tool that focus move blurs the just-mounted overlay textarea
  // before a character can be typed, and its empty-blur handler then commits
  // nothing and unmounts it — so text was impossible to enter. preventDefault
  // on mousedown suppresses the focus steal (pointer events still fire, so
  // drawing/panning are unaffected). It must be mousedown, not pointerdown:
  // preventing pointerdown's default does not stop the mousedown focus action.
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
  }

  function commitTextOverlay() {
    if (closingTextRef.current || !textEditor) return;
    closingTextRef.current = true;
    brainstorm.commitText(textEditor.world, textareaRef.current?.value ?? "", textEditor.id);
    setTextEditor(null);
  }

  function discardTextOverlay() {
    closingTextRef.current = true;
    setTextEditor(null);
  }

  function canvasCenterScreenPoint() {
    const canvas = canvasRef.current;
    return canvas ? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 } : { x: 0, y: 0 };
  }

  async function handleExportPng() {
    const blob = await brainstorm.exportPngBlob();
    triggerDownload(blob, "brainstorm.png");
  }

  function handleExportJson() {
    const blob = new Blob([brainstorm.exportJsonText()], { type: "application/json" });
    triggerDownload(blob, "brainstorm.json");
  }

  function handleImportJson(text: string) {
    const result = brainstorm.importJsonText(text);
    setImportError(result.ok ? null : result.error ?? "Import failed.");
  }

  return (
    <div className="space-y-3">
      <Toolbar
        tool={brainstorm.tool}
        setTool={brainstorm.setTool}
        strokeColor={brainstorm.strokeColor}
        setStrokeColor={brainstorm.setStrokeColor}
        fillColor={brainstorm.fillColor}
        setFillColor={brainstorm.setFillColor}
        strokeWidth={brainstorm.strokeWidth}
        setStrokeWidth={brainstorm.setStrokeWidth}
        zoom={brainstorm.viewport.zoom}
        onZoomIn={() => brainstorm.zoomAtCursor(canvasCenterScreenPoint(), ZOOM_STEP)}
        onZoomOut={() => brainstorm.zoomAtCursor(canvasCenterScreenPoint(), -ZOOM_STEP)}
        canUndo={brainstorm.canUndo}
        canRedo={brainstorm.canRedo}
        onUndo={brainstorm.undo}
        onRedo={brainstorm.redo}
        onDuplicate={brainstorm.duplicateSelection}
        onDelete={brainstorm.deleteSelection}
        hasSelection={brainstorm.selectedIds.length > 0}
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onClear={brainstorm.clear}
        elementCount={brainstorm.scene.elements.length}
      />

      {importError && (
        <p role="alert" className="text-sm text-destructive">
          {importError}
        </p>
      )}

      <div ref={containerRef} className="relative h-[600px] w-full overflow-hidden rounded-lg border bg-background">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Brainstorm whiteboard canvas"
          className="block h-full w-full touch-none"
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {textEditor && (
          <textarea
            key={textEditor.id ?? "new"}
            ref={textareaRef}
            aria-label="Text element editor"
            defaultValue={textEditor.initialText}
            className="absolute resize-none border border-dashed border-primary bg-transparent p-0 leading-none outline-none"
            style={{
              left: worldToScreen(textEditor.world, brainstorm.viewport).x,
              top: worldToScreen(textEditor.world, brainstorm.viewport).y,
              fontSize: TEXT_FONT_SIZE * brainstorm.viewport.zoom,
              color: textEditor.color,
              minWidth: 60,
            }}
            onBlur={commitTextOverlay}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                discardTextOverlay();
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitTextOverlay();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

const RESIZE_HANDLE_HALF_SIZE = 4;

/**
 * Selection box + corner handles, drawn with plain Canvas2D calls (not
 * roughjs — selection UI is chrome, not part of the sketchy drawing). Mirrors
 * useBrainstorm's hitTestResizeHandle corner positions for visual
 * consistency, but is a separate, simpler implementation since this only
 * needs draw positions, not hit-tolerance math.
 */
function drawSelectionOverlay(ctx: CanvasRenderingContext2D, scene: Scene, selectedIds: string[], viewport: { zoom: number }) {
  if (selectedIds.length !== 1) return;
  const el = scene.elements.find((e) => e.id === selectedIds[0]);
  if (!el) return;
  const box = boundingBox(el);
  const handleSize = RESIZE_HANDLE_HALF_SIZE / viewport.zoom;

  ctx.save();
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 1 / viewport.zoom;
  ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.setLineDash([]);

  ctx.fillStyle = "#3b82f6";
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x, y: box.y + box.h },
    { x: box.x + box.w, y: box.y + box.h },
  ];
  for (const corner of corners) {
    ctx.fillRect(corner.x - handleSize, corner.y - handleSize, handleSize * 2, handleSize * 2);
  }
  ctx.restore();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
