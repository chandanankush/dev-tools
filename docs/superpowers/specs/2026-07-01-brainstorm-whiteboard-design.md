# Brainstorm Whiteboard — Design Spec

**Date:** 2026-07-01
**Status:** Approved (design). Implementation plan: `docs/superpowers/plans/2026-07-01-brainstorm-whiteboard.md`
**Tool slug:** `brainstorm`

## Summary

A self-hosted, client-side infinite whiteboard tool ("Brainstorm") providing
Excalidraw-style capabilities at a focused, core feature set. Built as a custom
Canvas2D renderer with a hand-drawn (sketchy) aesthetic. No server-side
component — all logic runs in the browser, the scene auto-saves to
`localStorage`, and the only new runtime dependency is `roughjs`.

This tool deliberately does **not** embed `@excalidraw/excalidraw` (bundle size +
CSP/font conflicts with this repo's strict nonce CSP and `require-corp` COEP) and
does **not** use `tldraw` (its license requires a visible watermark on public
sites). A custom canvas is fully compatible with the project's CSP and
architecture constraints.

## Goals

- Infinite, pannable, zoomable canvas.
- Hand-drawn / sketchy rendering for geometric shapes.
- Core tools: select, pen (freehand), rectangle, ellipse, line, arrow, text, eraser.
- Move, duplicate, delete, and **resize** selected elements.
- Undo / redo.
- Single auto-saved board persisted to `localStorage`.
- Export to PNG; export/import scene as JSON (escape hatch for the single-board limit).
- Full compatibility with the project's strict nonce-based CSP (no `<style>`
  injection, no remote fonts).

## Non-Goals (out of scope for v1)

- Multiple named boards (single board only; JSON export/import covers variants).
- SVG export.
- Real-time collaboration / any server persistence.
- Component libraries / shape libraries.
- Pressure-sensitive `perfect-freehand` strokes (hand-rolled smoothing instead).

## Approach & Dependencies

- **Rendering:** Custom **Canvas2D** with a retained scene model and a
  per-element render cache. Chosen over SVG because infinite pan/zoom plus many
  freehand strokes degrade with SVG's per-element DOM nodes.
- **`roughjs`** (~9KB, MIT): sketchy rendering for rectangle/ellipse/line/arrow.
  Drawables are cached per element so re-renders on pan/zoom are cheap and stable.
- **Freehand pen:** hand-rolled quadratic-curve smoothing over captured pointer
  points. No `perfect-freehand` dependency.
- **CSP:** `roughjs` and the canvas approach are pure JS — no `<style>` tag
  injection, no remote font loads — so they comply with the strict nonce CSP,
  COOP/COEP, and CORP headers enforced in `proxy.ts`.

## Data Model & Persistence

Pure, serializable scene model. This is exactly what is auto-saved to
`localStorage` and what JSON export/import reads/writes.

```ts
type Scene = { version: 1; elements: Element[] };

type Base = {
  id: string;          // stable unique id
  strokeColor: string;
  strokeWidth: number;
  seed: number;        // roughjs randomization seed, persisted per element
};

type FreedrawElement = Base & {
  type: "freedraw";
  points: [number, number][];   // world coordinates
};

type ShapeElement = Base & {
  type: "rectangle" | "ellipse" | "line" | "arrow";
  x: number; y: number; w: number; h: number;  // world coords; w/h may be negative pre-normalization
  fillColor: string | null;
};

type TextElement = Base & {
  type: "text";
  x: number; y: number;
  text: string;
  fontSize: number;
};

type Element = FreedrawElement | ShapeElement | TextElement;
```

- **`seed`** must be persisted. Without a stable per-element seed, roughjs
  re-randomizes the sketchy paths on every render, causing visible jitter on
  pan/zoom.
- **Viewport** `{ scrollX: number; scrollY: number; zoom: number }` is session
  state — held in component state, not part of the persisted `Scene`.
- **Persistence:** single scene under one versioned `localStorage` key
  (`brainstorm:scene:v1`), with debounced writes. Quota/write failures are
  caught and surfaced quietly without breaking the editor.
- **Export PNG:** render the scene to an offscreen canvas (2× scale) and
  `toBlob` → download.
- **Export / Import JSON:** the `Scene` object verbatim; import is validated and
  rejects malformed input with an error message rather than throwing.

## Module Breakdown

Pure logic lives in `lib/brainstorm/` (unit-tested); the React component stays
thin. This deliberately avoids the monolith pattern of `EditorPad.tsx` (58KB).

```
lib/brainstorm/
  types.ts        Scene, Element, Viewport type definitions
  scene.ts        pure reducers: create/add/update/remove/duplicate element
  geometry.ts     hitTest(point, element), boundingBox(element), distToSegment,
                  resize transforms, normalize negative w/h
  viewport.ts     screen<->world transforms, zoomAt(point, delta), pan
  render.ts       drawScene(ctx, scene, viewport); roughjs drawable cache keyed by id
  serialize.ts    toJSON / fromJSON (validated), exportPng
  storage.ts      load/save scene to localStorage (debounced, versioned)
  history.ts      undo/redo stack over Scene snapshots (bounded)

components/tools/Brainstorm/
  index.tsx       orchestration: canvas ref, rAF render loop, event wiring
  Toolbar.tsx     tool selection, color/fill/stroke, zoom %, undo/redo, export, import, clear
  useBrainstorm.ts hook: scene + history + viewport state, pointer/keyboard handlers
```

- Pure modules (`scene`, `geometry`, `viewport`, `serialize`, `history`) carry
  the bulk of correctness and are unit-tested.
- The component is thin: canvas ref, requestAnimationFrame render loop, pointer
  and keyboard wiring.
- Registered as a single entry in `lib/tools.config.ts`:
  - `slug: "brainstorm"`
  - `component: () => import("@/components/tools/Brainstorm")`
  - title, description, tags, thumbnail, icon per existing convention.

## Tools & Interactions

**Toolbar:** select (V), pen, rectangle, ellipse, line, arrow, text, eraser;
plus stroke color, fill color, stroke width, zoom %, undo, redo, export (PNG /
JSON), import JSON, clear.

| Interaction      | Behavior                                                                 |
|------------------|--------------------------------------------------------------------------|
| Draw shape       | pointer-down sets origin, drag sizes it, up commits (w/h normalized)     |
| Pen              | collect points on move, commit a freedraw element on up                  |
| Text             | click places caret; an overlay `<textarea>` positioned in world coords commits to a text element on blur |
| Select           | click hit-tests topmost element; drag moves it; shows bounding box + resize handles |
| Resize           | drag a corner handle of the selected shape; transform applied via geometry module |
| Eraser           | drag removes elements under the cursor                                   |
| Duplicate        | Ctrl/Cmd+D clones selection with a small offset                          |
| Delete           | Delete / Backspace removes selection                                     |
| Undo / Redo      | Ctrl+Z / Ctrl+Shift+Z over scene snapshots                               |
| Pan              | Space-drag or middle-mouse; trackpad scroll                              |
| Zoom             | Ctrl/Cmd+scroll or pinch; zoom-to-cursor                                 |

Resize (corner handles for selected shapes) is **included in v1**.

## Testing & Error Handling

- **Unit tests (Vitest)** for pure modules:
  - `geometry`: hit-test for each shape type, edge cases at non-1 zoom, resize
    transforms, bounding-box correctness, negative w/h normalization.
  - `viewport`: screen<->world round-trip, zoom-to-cursor math.
  - `scene`: reducer correctness (add/update/remove/duplicate).
  - `serialize`: `fromJSON` rejects malformed/wrong-version input gracefully;
    `toJSON`/`fromJSON` round-trip.
  - `history`: undo/redo bounds and ordering.
- **Import validation:** `fromJSON` validates element shape and `version`; bad
  input surfaces an error to the user and never throws into the render loop.
- **Resilience:** render loop guarded against empty/large scenes; `localStorage`
  write failures (e.g. quota) are caught and surfaced quietly.

## Security & Project-Rule Compliance

- All logic client-side; no new server APIs, no SSRF surface.
- `localStorage` only for persistence (no cookies/IndexedDB).
- Single tool-registry entry in `lib/tools.config.ts`.
- No `<style>` tag injection or remote fonts → strict nonce CSP, COOP/COEP, CORP
  all unaffected.
- Element ids/seeds: use `crypto.getRandomValues` based generation; if any
  bounded random index is needed, use rejection sampling (`unbiasedRandom`) per
  the project's no-modulo-bias rule. (Seeds for roughjs are not security
  sensitive but should still avoid `Math.random` for consistency.)
- Pre-commit gate respected: `pnpm test`, `pnpm build`, `pnpm lint` must pass.

## Open Questions / Future (Phase 2)

- Multiple named boards (sidebar) if the single-board limit proves restrictive.
- SVG export.
- Snapping / alignment guides.
- Arrow binding to shapes.
