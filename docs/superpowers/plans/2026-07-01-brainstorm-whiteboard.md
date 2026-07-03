# Brainstorm Whiteboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `brainstorm` tool per `docs/superpowers/specs/2026-07-01-brainstorm-whiteboard-design.md` — a self-hosted, client-side infinite whiteboard with hand-drawn rendering, registered as a new entry in the tool gallery.

**Architecture:** Pure, unit-tested logic in `lib/brainstorm/` (types, scene reducers, geometry/hit-testing, viewport transforms, JSON serialization, debounced `localStorage` persistence, bounded undo/redo history). A thin `components/tools/Brainstorm/` React layer owns the `<canvas>` ref, the `requestAnimationFrame` render loop, and pointer/keyboard event wiring, delegating all decisions to the pure modules. `roughjs` renders sketchy shapes; a per-element drawable cache (keyed by element id, invalidated on element mutation) keeps re-renders on pan/zoom cheap. No new dependencies beyond `roughjs` — no server APIs, no new persistence mechanism beyond `localStorage`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Vitest 4 + Testing Library, `roughjs` (new dependency)

**Existing conventions this plan follows (confirmed in codebase, not assumed):**
- `lib/` has no shared random-number helper. `unbiasedRandom(n)` (rejection sampling) is only ever needed for a **bounded** random index; this tool only needs (a) unique ids and (b) an arbitrary roughjs seed, neither of which involves a modulo. So: ids via `crypto.randomUUID()` (same as `UuidGenerator.tsx`), seeds via the raw `crypto.getRandomValues(new Uint32Array(1))[0]` value with **no modulo applied** — this sidesteps the bias rule entirely rather than needing rejection sampling. Do not add an unused `unbiasedRandom` helper.
- `localStorage` debounce pattern follows `EditorPad.tsx`: a `useRef<ReturnType<typeof setTimeout> | null>` timer, manual `setTimeout`/`clearTimeout`, cleared on unmount — no debounce library.
- No tool currently uses `<canvas>`. `tests/setup.ts` has no canvas, `ResizeObserver`, or pointer-capture polyfills. Task 1 adds them globally (additive only — confirmed no existing test exercises canvas, so this cannot regress anything).
- Thumbnail reuse: several existing tools (`timestamp-converter`, `password-generator`, `basic-calculator`, `editor-pad`) ship with a placeholder thumbnail (`uuidThumbnail`) rather than bespoke art. This plan follows that precedent for `brainstorm` and does not block on commissioning new artwork.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` / `pnpm-lock.yaml` | Modify | Add `roughjs` dependency |
| `tests/setup.ts` | Modify | Add canvas 2D context stub, `ResizeObserver` stub, pointer-capture no-ops |
| `lib/brainstorm/types.ts` | Create | `Scene`, `Element`, `Viewport` type definitions |
| `lib/brainstorm/scene.ts` | Create | Pure reducers: create/add/update/remove/duplicate element |
| `tests/brainstorm/scene.test.ts` | Create | Reducer correctness |
| `lib/brainstorm/geometry.ts` | Create | `hitTest`, `boundingBox`, `distToSegment`, resize transforms, w/h normalization |
| `tests/brainstorm/geometry.test.ts` | Create | Hit-test per shape, non-1 zoom, resize, normalization |
| `lib/brainstorm/viewport.ts` | Create | screen↔world transforms, `zoomAt`, `pan` |
| `tests/brainstorm/viewport.test.ts` | Create | Round-trip transforms, zoom-to-cursor math |
| `lib/brainstorm/serialize.ts` | Create | `toJSON`/`fromJSON` (validated), `exportPng` |
| `tests/brainstorm/serialize.test.ts` | Create | Round-trip, malformed/wrong-version rejection |
| `lib/brainstorm/storage.ts` | Create | Debounced, versioned `localStorage` load/save |
| `tests/brainstorm/storage.test.ts` | Create | Save/load round-trip, quota-failure handling, debounce |
| `lib/brainstorm/history.ts` | Create | Bounded undo/redo stack over `Scene` snapshots |
| `tests/brainstorm/history.test.ts` | Create | Undo/redo bounds and ordering |
| `lib/brainstorm/render.ts` | Create | `drawScene(ctx, scene, viewport)`; roughjs drawable cache keyed by id |
| `tests/brainstorm/render.test.ts` | Create | Smoke tests against the canvas stub (doesn't throw, cache reused) |
| `components/tools/Brainstorm/useBrainstorm.ts` | Create | Hook: scene + history + viewport state, pointer/keyboard handlers |
| `components/tools/Brainstorm/Toolbar.tsx` | Create | Tool selection, color/fill/stroke, zoom %, undo/redo, export, import, clear |
| `components/tools/Brainstorm/index.tsx` | Create | Orchestration: canvas ref, rAF render loop, event wiring |
| `tests/tools/brainstorm.test.tsx` | Create | Component-level interaction tests (draw, select, undo, export) |
| `lib/tools.config.ts` | Modify | Register `brainstorm` tool entry |
| `tests/tools.config.test.ts` (or extend existing test if present) | Create/Modify | Verify registry entry resolves and is included in `toolSummaries` |

---

### Task 1: Add `roughjs` and canvas/pointer test infrastructure

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `tests/setup.ts`

No existing tool touches `<canvas>`, so jsdom's lack of 2D context, `ResizeObserver`, and pointer-capture support has never mattered before. Every later task in this plan depends on this groundwork being in place first.

- [ ] **Step 1: Install `roughjs`**

```bash
pnpm add roughjs
```

Expected: `roughjs` appears in `package.json` `dependencies` and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Add canvas/pointer/ResizeObserver stubs to `tests/setup.ts`**

Append to `tests/setup.ts` (keep the existing `next/image` mock and `afterEach` block untouched):

```ts
// IMPORTANT: roughjs's RoughCanvas does `this.ctx = this.canvas.getContext('2d')`
// internally — it re-derives the context from the canvas element rather than
// using whatever ctx the caller passed around. So `ctx.canvas` must be the
// *real* <canvas> element (whose own `getContext` is the stub below), never a
// plain object literal — otherwise `rough.canvas(ctx.canvas)` throws
// "ctx.canvas.getContext is not a function" in every render/component test.
class FakeCanvasRenderingContext2D {
  // Minimal surface area: every method roughjs/render.ts calls on a 2D
  // context, implemented as no-ops. Add methods here if a later task's
  // render code calls something not yet listed — do not add unused ones.
  canvas: HTMLCanvasElement;
  constructor(canvasEl: HTMLCanvasElement) {
    this.canvas = canvasEl;
  }
  save = vi.fn();
  restore = vi.fn();
  scale = vi.fn();
  translate = vi.fn();
  rotate = vi.fn();
  clearRect = vi.fn();
  fillRect = vi.fn();
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  bezierCurveTo = vi.fn();
  quadraticCurveTo = vi.fn();
  arc = vi.fn();
  stroke = vi.fn();
  fill = vi.fn();
  setLineDash = vi.fn();
  measureText = vi.fn(() => ({ width: 0 }));
  fillText = vi.fn();
  drawImage = vi.fn();
  strokeStyle = "";
  fillStyle = "";
  lineWidth = 1;
  lineDashOffset = 0;
  font = "";
  globalAlpha = 1;
}

HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
  return new FakeCanvasRenderingContext2D(this);
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob()));
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,");

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom implements PointerEvent but not pointer capture; calling these throws
// "not implemented" unless stubbed.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}
```

Note: the stub is assigned once via top-level statements (module load), not inside `afterEach`. `vi.restoreAllMocks()` in the existing `afterEach` block resets mock *implementations/call history* but does not unassign the prototype property itself, since the assignment isn't tracked as a spy on a pre-existing method (there was no original `getContext` to restore to). Still, this needs explicit proof, not assumption — Step 3 must include a same-file multi-test check before relying on this in Task 8+.

- [ ] **Step 3: Confirm no regression and confirm the stub survives `afterEach` within a file**

```bash
pnpm test
```

Expected: all existing tests still pass (no test currently depends on `getContext` being `null`/undefined, confirmed by repo search before writing this plan). Additionally, write a temporary scratch test (delete after confirming) with two sequential `it()` blocks both asserting `document.createElement("canvas").getContext("2d")` returns a non-null `FakeCanvasRenderingContext2D` instance — this proves the stub isn't neutered by `restoreAllMocks()` between tests in the same file. If it *is* neutered, move the assignment into a `beforeEach` instead of a one-time top-level statement.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml tests/setup.ts
git commit -m "chore(brainstorm): add roughjs dependency and canvas/pointer test polyfills"
```

---

### Task 2: `lib/brainstorm/types.ts` and `lib/brainstorm/scene.ts` (TDD)

**Files:**
- Create: `lib/brainstorm/types.ts`
- Create: `lib/brainstorm/scene.ts`
- Create: `tests/brainstorm/scene.test.ts`

- [ ] **Step 1: Create `lib/brainstorm/types.ts`**

Transcribe the data model from the spec verbatim (this is already fully specified there — no design decision left open):

```ts
export type Scene = { version: 1; elements: Element[] };

export type Base = {
  id: string;
  strokeColor: string;
  strokeWidth: number;
  seed: number;
};

export type FreedrawElement = Base & {
  type: "freedraw";
  points: [number, number][];
};

export type ShapeElement = Base & {
  type: "rectangle" | "ellipse" | "line" | "arrow";
  x: number;
  y: number;
  w: number;
  h: number;
  fillColor: string | null;
};

export type TextElement = Base & {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
};

export type Element = FreedrawElement | ShapeElement | TextElement;

export type Viewport = { scrollX: number; scrollY: number; zoom: number };

export function createEmptyScene(): Scene {
  return { version: 1, elements: [] };
}
```

- [ ] **Step 2: Write failing tests for `scene.ts`**

Create `tests/brainstorm/scene.test.ts` covering, at minimum:

```ts
import { describe, it, expect } from "vitest";
import { addElement, updateElement, removeElement, duplicateElement } from "@/lib/brainstorm/scene";
import { createEmptyScene } from "@/lib/brainstorm/types";
import type { ShapeElement } from "@/lib/brainstorm/types";

const rect: ShapeElement = {
  id: "rect-1", type: "rectangle", x: 0, y: 0, w: 10, h: 10,
  strokeColor: "#000", strokeWidth: 1, fillColor: null, seed: 1,
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
});

describe("duplicateElement", () => {
  it("clones with a new id and an offset position", () => {
    const scene = addElement(createEmptyScene(), rect);
    const next = duplicateElement(scene, "rect-1");
    expect(next.elements).toHaveLength(2);
    const clone = next.elements[1] as ShapeElement;
    expect(clone.id).not.toBe("rect-1");
    expect(clone.x).toBeGreaterThan(rect.x);
    expect(clone.y).toBeGreaterThan(rect.y);
  });

  it("is a no-op for an unknown id", () => {
    const scene = addElement(createEmptyScene(), rect);
    expect(duplicateElement(scene, "nope")).toEqual(scene);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
pnpm test tests/brainstorm/scene.test.ts
```

Expected: `Cannot find module '@/lib/brainstorm/scene'`

- [ ] **Step 4: Implement `lib/brainstorm/scene.ts`**

```ts
import type { Element, Scene } from "./types";

export function addElement(scene: Scene, element: Element): Scene {
  return { ...scene, elements: [...scene.elements, element] };
}

export function updateElement(scene: Scene, id: string, patch: Partial<Element>): Scene {
  if (!scene.elements.some((el) => el.id === id)) return scene;
  return {
    ...scene,
    elements: scene.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as Element) : el)),
  };
}

export function removeElement(scene: Scene, id: string): Scene {
  return { ...scene, elements: scene.elements.filter((el) => el.id !== id) };
}

const DUPLICATE_OFFSET = 10;

export function duplicateElement(scene: Scene, id: string): Scene {
  const original = scene.elements.find((el) => el.id === id);
  if (!original) return scene;
  const clone: Element = {
    ...original,
    id: crypto.randomUUID(),
    ...("x" in original ? { x: original.x + DUPLICATE_OFFSET, y: original.y + DUPLICATE_OFFSET } : {}),
    ...("points" in original
      ? { points: original.points.map(([x, y]) => [x + DUPLICATE_OFFSET, y + DUPLICATE_OFFSET] as [number, number]) }
      : {}),
  };
  return addElement(scene, clone);
}
```

Known soundness gap, accepted for v1: `updateElement`'s `patch: Partial<Element>` is a union of all three element shapes, so `{ ...el, ...patch } as Element` lets a caller pass `{ points: [...] }` to a `ShapeElement` without a type error — the `as Element` cast hides it. This is an internal module, not an API boundary the spec's input-validation rule covers, and the hook (Task 9) only ever calls `updateElement` with patches shaped for the element it just hit-tested, so it's not reachable in practice. If this needs tightening later, change the signature to `updateElement<T extends Element>(scene: Scene, id: string, patch: Partial<T>)` and let call sites narrow.

- [ ] **Step 5: Run to confirm pass**

```bash
pnpm test tests/brainstorm/scene.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/brainstorm/types.ts lib/brainstorm/scene.ts tests/brainstorm/scene.test.ts
git commit -m "feat(brainstorm): scene data model and pure reducers"
```

---

### Task 3: `lib/brainstorm/geometry.ts` (TDD)

**Files:**
- Create: `lib/brainstorm/geometry.ts`
- Create: `tests/brainstorm/geometry.test.ts`

This is the highest-risk module for subtle bugs (hit-testing at non-1 zoom, negative w/h). Write the test cases from the spec's testing section before implementing.

- [ ] **Step 1: Write failing tests**

Create `tests/brainstorm/geometry.test.ts` with cases for:
- `boundingBox(element)` for each of `rectangle`, `ellipse`, `line`, `arrow`, `freedraw`, `text` — assert correct `{x, y, w, h}` including the freedraw case (bbox of all points) and the text case (uses `fontSize` to estimate height, width from `text.length` as an approximation — document the approximation in a comment since exact text metrics require a canvas context).
- `normalizeShape(element)` — given `w: -10, h: -10`, returns an equivalent element with positive `w`/`h` and adjusted `x`/`y` so the visual rectangle is unchanged.
- `hitTest(point, element, zoom)` — a point inside a rectangle's bbox hits; a point outside misses; for `line`/`arrow`, a point within `strokeWidth`-scaled tolerance of the segment hits via `distToSegment`, a point far away misses; tolerance must scale inversely with `zoom` (a thin line at zoom 0.1 still needs a generous hit tolerance in screen space) — assert a point that misses at `zoom: 1` hits at `zoom: 0.1` for the same screen-space distance.
- `distToSegment(point, a, b)` — point on the segment → ~0; point off the perpendicular → correct perpendicular distance; degenerate segment (`a === b`) → distance to the point, not `NaN`.
- `resizeShape(element, handle, dx, dy)` for each of the 4 corner handles — verify the opposite corner stays fixed and `w`/`h` change by the expected amount; verify dragging past the opposite corner flips sign correctly (resize through zero) rather than producing inverted/unnormalized geometry.

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/brainstorm/geometry.test.ts
```

Expected: `Cannot find module '@/lib/brainstorm/geometry'`

- [ ] **Step 3: Implement `lib/brainstorm/geometry.ts`**

Implement exactly the functions exercised by Step 1's tests: `boundingBox`, `normalizeShape`, `distToSegment`, `hitTest`, `resizeShape`, plus a `type ResizeHandle = "nw" | "ne" | "sw" | "se"`. Use straightforward axis-aligned bbox math for rectangle/ellipse hit-testing (ellipse hit-test may approximate with its bbox for v1 — note this as a deliberate simplification, not a bug, in a comment) and point-to-segment distance for line/arrow.

- [ ] **Step 4: Run to confirm pass, then full suite**

```bash
pnpm test tests/brainstorm/geometry.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/brainstorm/geometry.ts tests/brainstorm/geometry.test.ts
git commit -m "feat(brainstorm): geometry — hit-testing, bbox, resize transforms"
```

---

### Task 4: `lib/brainstorm/viewport.ts` (TDD)

**Files:**
- Create: `lib/brainstorm/viewport.ts`
- Create: `tests/brainstorm/viewport.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { screenToWorld, worldToScreen, zoomAt, pan } from "@/lib/brainstorm/viewport";
import type { Viewport } from "@/lib/brainstorm/types";

const vp: Viewport = { scrollX: 0, scrollY: 0, zoom: 1 };

describe("screenToWorld / worldToScreen", () => {
  it("round-trips at zoom 1", () => {
    const world = screenToWorld({ x: 100, y: 50 }, vp);
    expect(worldToScreen(world, vp)).toEqual({ x: 100, y: 50 });
  });

  it("round-trips at non-1 zoom and non-zero scroll", () => {
    const vp2: Viewport = { scrollX: 30, scrollY: -20, zoom: 2.5 };
    const world = screenToWorld({ x: 200, y: 150 }, vp2);
    const back = worldToScreen(world, vp2);
    expect(back.x).toBeCloseTo(200);
    expect(back.y).toBeCloseTo(150);
  });
});

describe("zoomAt", () => {
  it("keeps the cursor's world point fixed on screen after zooming", () => {
    const cursor = { x: 400, y: 300 };
    const before = screenToWorld(cursor, vp);
    const next = zoomAt(vp, cursor, 0.1); // zoom in
    const after = screenToWorld(cursor, next);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(next.zoom).toBeGreaterThan(vp.zoom);
  });

  it("clamps zoom to a sane min/max range", () => {
    const tinyZoom = zoomAt({ ...vp, zoom: 0.05 }, { x: 0, y: 0 }, -10);
    const hugeZoom = zoomAt({ ...vp, zoom: 20 }, { x: 0, y: 0 }, 10);
    expect(tinyZoom.zoom).toBeGreaterThanOrEqual(0.1);
    expect(hugeZoom.zoom).toBeLessThanOrEqual(10);
  });
});

describe("pan", () => {
  it("shifts scrollX/scrollY by the given screen-space delta", () => {
    const next = pan(vp, { dx: 10, dy: -5 });
    expect(next).toEqual({ ...vp, scrollX: 10, scrollY: -5 });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/brainstorm/viewport.test.ts
```

- [ ] **Step 3: Implement `lib/brainstorm/viewport.ts`**

```ts
import type { Viewport } from "./types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export function screenToWorld(point: { x: number; y: number }, vp: Viewport) {
  return { x: (point.x - vp.scrollX) / vp.zoom, y: (point.y - vp.scrollY) / vp.zoom };
}

export function worldToScreen(point: { x: number; y: number }, vp: Viewport) {
  return { x: point.x * vp.zoom + vp.scrollX, y: point.y * vp.zoom + vp.scrollY };
}

export function zoomAt(vp: Viewport, cursor: { x: number; y: number }, delta: number): Viewport {
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * (1 + delta)));
  const worldBefore = screenToWorld(cursor, vp);
  // Solve for the scroll that keeps worldBefore projecting back to `cursor`
  // at the new zoom level.
  return {
    zoom: nextZoom,
    scrollX: cursor.x - worldBefore.x * nextZoom,
    scrollY: cursor.y - worldBefore.y * nextZoom,
  };
}

export function pan(vp: Viewport, delta: { dx: number; dy: number }): Viewport {
  return { ...vp, scrollX: vp.scrollX + delta.dx, scrollY: vp.scrollY + delta.dy };
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/brainstorm/viewport.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/brainstorm/viewport.ts tests/brainstorm/viewport.test.ts
git commit -m "feat(brainstorm): viewport screen/world transforms and zoom-to-cursor"
```

---

### Task 5: `lib/brainstorm/serialize.ts` (TDD)

**Files:**
- Create: `lib/brainstorm/serialize.ts`
- Create: `tests/brainstorm/serialize.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { toJSON, fromJSON } from "@/lib/brainstorm/serialize";
import { createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { ShapeElement } from "@/lib/brainstorm/types";

const rect: ShapeElement = {
  id: "r1", type: "rectangle", x: 0, y: 0, w: 5, h: 5,
  strokeColor: "#000", strokeWidth: 1, fillColor: null, seed: 1,
};

describe("toJSON / fromJSON", () => {
  it("round-trips a populated scene", () => {
    const scene = addElement(createEmptyScene(), rect);
    const result = fromJSON(toJSON(scene));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene).toEqual(scene);
  });

  it("rejects invalid JSON text", () => {
    const result = fromJSON("{not json");
    expect(result.ok).toBe(false);
  });

  it("rejects a missing version field", () => {
    const result = fromJSON(JSON.stringify({ elements: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported version number", () => {
    const result = fromJSON(JSON.stringify({ version: 2, elements: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects an element missing required fields", () => {
    const result = fromJSON(JSON.stringify({ version: 1, elements: [{ type: "rectangle" }] }));
    expect(result.ok).toBe(false);
  });

  it("rejects a non-array elements field", () => {
    const result = fromJSON(JSON.stringify({ version: 1, elements: "nope" }));
    expect(result.ok).toBe(false);
  });
});
```

Note: `exportPng` is intentionally *not* unit-tested here — it's a thin canvas-to-blob wrapper with no branching logic worth asserting beyond "doesn't throw," which is covered by the component-level test in Task 9 (export button click).

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/brainstorm/serialize.test.ts
```

- [ ] **Step 3: Implement `lib/brainstorm/serialize.ts`**

Implement `toJSON(scene): string` as `JSON.stringify(scene)`, and `fromJSON(text): { ok: true; scene: Scene } | { ok: false; error: string }` with a hand-rolled validator (no new schema-validation dependency — this is a small, fixed shape) that checks: text parses as JSON; result is an object with `version === 1`; `elements` is an array; every element has the required `Base` fields (`id: string`, `strokeColor: string`, `strokeWidth: number`, `seed: number`) plus the fields required by its `type` discriminant. Reject and return `{ ok: false, error }` rather than throwing — `fromJSON` must never throw into a caller that doesn't expect it (per spec's error-handling requirement).

Add `exportPng(scene, viewport, options: { scale: number }): Promise<Blob>`: render to an offscreen `OffscreenCanvas` or a detached `<canvas>` at `scale`× device pixels via `drawScene` (from Task 8's `render.ts` — this creates a dependency; if Task 8 isn't done yet, stub `exportPng` to throw `"not implemented"` and revisit once `render.ts` exists, or reorder so Task 8 lands before this function is implemented). **Decision: implement `exportPng` as the last step of Task 8 instead, once `drawScene` exists — leave a `// TODO(Task 8)` placeholder here for now.**

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/brainstorm/serialize.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/brainstorm/serialize.ts tests/brainstorm/serialize.test.ts
git commit -m "feat(brainstorm): scene JSON serialization with validated import"
```

---

### Task 6: `lib/brainstorm/storage.ts` (TDD)

**Files:**
- Create: `lib/brainstorm/storage.ts`
- Create: `tests/brainstorm/storage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveScene, loadScene, STORAGE_KEY } from "@/lib/brainstorm/storage";
import { createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { ShapeElement } from "@/lib/brainstorm/types";

beforeEach(() => localStorage.clear());

describe("saveScene / loadScene", () => {
  it("round-trips a scene through localStorage", () => {
    const rect: ShapeElement = {
      id: "r1", type: "rectangle", x: 0, y: 0, w: 5, h: 5,
      strokeColor: "#000", strokeWidth: 1, fillColor: null, seed: 1,
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
    expect(loadScene()).toEqual(createEmptyScene());
  });

  it("swallows a quota-exceeded write error without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    expect(() => saveScene(createEmptyScene())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/brainstorm/storage.test.ts
```

- [ ] **Step 3: Implement `lib/brainstorm/storage.ts`**

```ts
import { createEmptyScene } from "./types";
import { toJSON, fromJSON } from "./serialize";
import type { Scene } from "./types";

export const STORAGE_KEY = "brainstorm:scene:v1";

export function saveScene(scene: Scene): void {
  try {
    localStorage.setItem(STORAGE_KEY, toJSON(scene));
  } catch {
    // Quota exceeded or storage unavailable (private browsing) — fail
    // quietly per spec; the editor must keep working without persistence.
  }
}

export function loadScene(): Scene {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyScene();
  const result = fromJSON(raw);
  return result.ok ? result.scene : createEmptyScene();
}
```

The debounce wrapper itself lives in `useBrainstorm.ts` (Task 9), following the `EditorPad.tsx` precedent of a `useRef` timer in the component/hook layer rather than inside the storage module — keeps `storage.ts` a pure synchronous I/O wrapper that's trivial to test.

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/brainstorm/storage.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/brainstorm/storage.ts tests/brainstorm/storage.test.ts
git commit -m "feat(brainstorm): versioned localStorage persistence with quota-failure handling"
```

---

### Task 7: `lib/brainstorm/history.ts` (TDD)

**Files:**
- Create: `lib/brainstorm/history.ts`
- Create: `tests/brainstorm/history.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createHistory, pushSnapshot, undo, redo } from "@/lib/brainstorm/history";
import { createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { ShapeElement } from "@/lib/brainstorm/types";

const rect = (id: string): ShapeElement => ({
  id, type: "rectangle", x: 0, y: 0, w: 1, h: 1,
  strokeColor: "#000", strokeWidth: 1, fillColor: null, seed: 1,
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
  });

  it("pushing a new snapshot clears the redo future", () => {
    let h = createHistory(createEmptyScene());
    h = pushSnapshot(h, addElement(createEmptyScene(), rect("a")));
    const afterUndo = undo(h);
    const afterPush = pushSnapshot(afterUndo.history, addElement(createEmptyScene(), rect("c")));
    const afterRedo = redo(afterPush);
    // redo should be a no-op now — the future was discarded by the new push
    expect(afterRedo.scene).toEqual(afterPush.present);
  });

  it("bounds the undo stack to a fixed maximum (does not grow unbounded)", () => {
    let h = createHistory(createEmptyScene());
    for (let i = 0; i < 200; i++) {
      h = pushSnapshot(h, addElement(createEmptyScene(), rect(`r${i}`)));
    }
    expect(h.past.length).toBeLessThanOrEqual(100); // exact cap defined in implementation
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/brainstorm/history.test.ts
```

- [ ] **Step 3: Implement `lib/brainstorm/history.ts`**

```ts
import type { Scene } from "./types";

export type History = { past: Scene[]; present: Scene; future: Scene[] };

const MAX_HISTORY = 100;

export function createHistory(initial: Scene): History {
  return { past: [], present: initial, future: [] };
}

export function pushSnapshot(history: History, next: Scene): History {
  const past = [...history.past, history.present].slice(-MAX_HISTORY);
  return { past, present: next, future: [] };
}

export function undo(history: History): { scene: Scene; history: History } {
  if (history.past.length === 0) return { scene: history.present, history };
  const previous = history.past[history.past.length - 1];
  const past = history.past.slice(0, -1);
  const future = [history.present, ...history.future];
  return { scene: previous, history: { past, present: previous, future } };
}

export function redo(history: History): { scene: Scene; history: History } {
  if (history.future.length === 0) return { scene: history.present, history };
  const [next, ...rest] = history.future;
  const past = [...history.past, history.present];
  return { scene: next, history: { past, present: next, future: rest } };
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/brainstorm/history.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/brainstorm/history.ts tests/brainstorm/history.test.ts
git commit -m "feat(brainstorm): bounded undo/redo history over scene snapshots"
```

---

### Task 8: `lib/brainstorm/render.ts` + finish `exportPng`

**Files:**
- Create: `lib/brainstorm/render.ts`
- Create: `tests/brainstorm/render.test.ts`
- Modify: `lib/brainstorm/serialize.ts` (replace the `exportPng` placeholder from Task 5)

This module is inherently side-effecting (draws to a canvas context), so it's smoke-tested against the `FakeCanvasRenderingContext2D` from Task 1 rather than asserting exact draw calls — the meaningful correctness lives in `geometry`/`viewport` (already tested) and in the drawable cache behavior, which *is* worth asserting.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { drawScene, createDrawableCache } from "@/lib/brainstorm/render";
import { createEmptyScene } from "@/lib/brainstorm/types";
import { addElement } from "@/lib/brainstorm/scene";
import type { ShapeElement } from "@/lib/brainstorm/types";

const rect: ShapeElement = {
  id: "r1", type: "rectangle", x: 0, y: 0, w: 10, h: 10,
  strokeColor: "#000", strokeWidth: 1, fillColor: null, seed: 1,
};

describe("drawScene", () => {
  it("does not throw for an empty scene", () => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    expect(() => drawScene(ctx, createEmptyScene(), { scrollX: 0, scrollY: 0, zoom: 1 }, createDrawableCache())).not.toThrow();
  });

  it("does not throw for a populated scene with each element type", () => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    const scene = addElement(createEmptyScene(), rect);
    expect(() => drawScene(ctx, scene, { scrollX: 0, scrollY: 0, zoom: 1 }, createDrawableCache())).not.toThrow();
  });
});

describe("drawable cache", () => {
  it("reuses the cached drawable for an unchanged element across renders (factory runs once, not twice)", () => {
    const cache = createDrawableCache();
    const ctx = document.createElement("canvas").getContext("2d")!;
    const scene = addElement(createEmptyScene(), rect);
    const vp = { scrollX: 0, scrollY: 0, zoom: 1 };
    let buildCount = 0;
    const build = () => {
      buildCount++;
      return { ops: [] };
    };
    drawScene(ctx, scene, vp, cache, build);
    drawScene(ctx, scene, vp, cache, build);
    // The assertion that actually proves cache reuse: the build callback
    // must have run exactly once across both drawScene calls, even though it
    // was passed in both times — the cache must short-circuit on a hit and
    // never invoke the factory for an unchanged element. (Asserting only
    // cache.size() === 1 would pass even for a cache that recomputes every
    // call but overwrites the same key — that's a weaker, insufficient test.)
    expect(buildCount).toBe(1);
    expect(cache.size()).toBe(1);
  });

  it("rebuilds (and replaces, not duplicates) the cache entry when the element is mutated", () => {
    const cache = createDrawableCache();
    const ctx = document.createElement("canvas").getContext("2d")!;
    const vp = { scrollX: 0, scrollY: 0, zoom: 1 };
    let buildCount = 0;
    const build = () => {
      buildCount++;
      return { ops: [] };
    };
    const scene1 = addElement(createEmptyScene(), rect);
    drawScene(ctx, scene1, vp, cache, build);
    const scene2 = { ...scene1, elements: [{ ...rect, w: 50 }] };
    drawScene(ctx, scene2, vp, cache, build);
    expect(buildCount).toBe(2); // signature changed (w: 10 -> 50) -> rebuilt, not reused
    expect(cache.size()).toBe(1); // still one entry for id "r1", replaced not duplicated
  });
});
```

`drawScene`'s signature takes an optional last `buildDrawable` override specifically so this test can count invocations without reaching into cache internals; production call sites (Task 11's `index.tsx`) omit it and `render.ts` defaults to the real `buildRoughDrawable`.

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/brainstorm/render.test.ts
```

- [ ] **Step 3: Implement `lib/brainstorm/render.ts`**

Key implementation notes (not full literal code, since the exact roughjs call shapes should be written against the installed version's actual types):
- `createDrawableCache()` returns an object backed by a `Map<string, { drawable: unknown; signature: string }>`, plus a `getOrCreate(id, signature, build)` method and a `size()` method. The caller passes a cheap structural fingerprint (e.g. `JSON.stringify(element)`) as `signature` — `getOrCreate` returns the cached `drawable` if `signature` matches the stored one, otherwise calls `build()`, stores the new `{ drawable, signature }`, and returns it. This is what makes the Task 8 Step 1 cache tests assertable: the test's `build` callback is the thing being counted, not `getOrCreate` itself.
- `drawScene(ctx, scene, viewport, cache, buildDrawable = buildRoughDrawable)`: clears the canvas, applies the viewport transform (`ctx.translate`/`ctx.scale` from `viewport.scrollX/scrollY/zoom`), then for each element calls `cache.getOrCreate(element.id, JSON.stringify(element), () => buildDrawable(element))`. **Critical:** the roughjs generator/canvas binding must be constructed from `ctx.canvas` (the actual `<canvas>` DOM element, e.g. `rough.canvas(ctx.canvas)`), never a synthetic object — `RoughCanvas`'s constructor internally calls `this.canvas.getContext('2d')` again rather than using the `ctx` passed into `drawScene`. This only works because Task 1's stub gives `ctx.canvas` a real `getContext` method that resolves back to an equivalent fake context; double-check Task 1's stub matches this requirement (a plain `{ width, height }` object literal for `ctx.canvas` would make this throw `ctx.canvas.getContext is not a function` in every test in this file and in Task 11).
- `buildRoughDrawable(element)` switches on `element.type`: `rectangle`/`ellipse` → `generator.rectangle`/`generator.ellipse` with `{ seed: element.seed, stroke: element.strokeColor, strokeWidth: element.strokeWidth, fill: element.fillColor ?? undefined }`; `line` → `generator.line(x1, y1, x2, y2, { seed, stroke, strokeWidth })`; `arrow` → the same `generator.line` for the shaft, plus two additional seeded `generator.line` calls for the arrowhead computed as: `angle = Math.atan2(y2 - y1, x2 - x1)`, head length `L = Math.min(20, lineLength * 0.3)` (shorter than the shaft on short arrows), head spread `±0.5` radians off the reversed shaft angle, so each head segment runs from `(x2, y2)` to `(x2 - L * Math.cos(angle - 0.5), y2 - L * Math.sin(angle - 0.5))` and the mirror with `angle + 0.5`; `freedraw` → a smoothed path built from `element.points` via `quadraticCurveTo` (midpoint-of-consecutive-points smoothing), stroked directly on `ctx` (no roughjs sketchiness on freehand — the points are already organic, and roughjs has no freehand-path primitive that takes raw points); `text` → no roughjs involvement, plain `ctx.fillText`.
- Finish `exportPng` in `serialize.ts`: create an in-memory canvas (`document.createElement("canvas")`, not `OffscreenCanvas` — Safari support for the latter is inconsistent and this repo has no SSR use for it) sized to the scene's bounding box (via `geometry.boundingBox` over all elements, unioned) × `options.scale`, call `drawScene` against its `2d` context with a viewport that maps the bbox's top-left to `(0,0)`, then `canvas.toBlob("image/png")` wrapped in a `Promise`.

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test tests/brainstorm/render.test.ts
pnpm test tests/brainstorm/serialize.test.ts
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/brainstorm/render.ts lib/brainstorm/serialize.ts tests/brainstorm/render.test.ts
git commit -m "feat(brainstorm): roughjs render pipeline with per-element drawable cache, finish PNG export"
```

---

### Task 9: `components/tools/Brainstorm/useBrainstorm.ts` (TDD via component tests)

**Files:**
- Create: `components/tools/Brainstorm/useBrainstorm.ts`
- Create: `tests/tools/brainstorm.test.tsx` (hook is exercised indirectly through the component in this task; Task 11 adds the remaining interaction tests once `Toolbar`/`index.tsx` exist)

This hook is the integration point: it owns `{ scene, history, viewport, selectedIds, tool }` state and exposes pointer/keyboard handlers. Because it's a hook (not a pure function), test it through a minimal harness component rather than calling it directly outside React.

- [ ] **Step 1: Write a failing test for debounced auto-save**

```tsx
// tests/tools/brainstorm-persistence.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBrainstorm } from "@/components/tools/Brainstorm/useBrainstorm";
import { loadScene, STORAGE_KEY } from "@/lib/brainstorm/storage";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

it("debounces saves and persists the scene to localStorage after the delay", () => {
  const { result } = renderHook(() => useBrainstorm());
  act(() => {
    result.current.setTool("rectangle");
    result.current.handlePointerDown({ x: 0, y: 0 });
    result.current.handlePointerMove({ x: 50, y: 50 });
    result.current.handlePointerUp({ x: 50, y: 50 });
  });
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull(); // not yet — debounced
  act(() => vi.advanceTimersByTime(600));
  expect(loadScene().elements).toHaveLength(1);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/tools/brainstorm-persistence.test.tsx
```

- [ ] **Step 3: Implement `useBrainstorm.ts`**

Shape of the hook (write the test cases below against this contract, then implement to satisfy them):

```ts
export type ToolName = "select" | "pen" | "rectangle" | "ellipse" | "line" | "arrow" | "text" | "eraser";

export function useBrainstorm() {
  // state: scene (derived from history.present), history, viewport, selectedIds, tool,
  // strokeColor, fillColor, strokeWidth
  // returns: { scene, viewport, tool, setTool, selectedIds,
  //   handlePointerDown, handlePointerMove, handlePointerUp,
  //   handleWheel, undo, redo, duplicateSelection, deleteSelection,
  //   exportPng, exportJson, importJson, clear, ... }
}
```

Implementation notes:
- Debounced save: a `useRef` timer (500ms, matching `EditorPad.tsx`'s `DEBOUNCE_MS` constant), `useEffect` on `scene` that resets the timer and calls `storage.saveScene`, cleared on unmount — copy the exact pattern from `EditorPad.tsx`, do not invent a new one.
- On mount, `loadScene()` seeds the initial `Scene` passed to `createHistory`.
- Pointer handlers delegate hit-testing to `geometry.hitTest`, coordinate conversion to `viewport.screenToWorld`, and all scene mutation to `scene.ts` reducers — the hook should contain no inline geometry math.
- Every mutating action (finishing a shape, moving/resizing/deleting/duplicating an element) calls `pushSnapshot` **exactly once per discrete user gesture** — this is the governing rule, and the eraser tool below must follow it too, not contradict it.
- `eraser` tool: on pointer-down, note the scene as it stood before any erasing in this drag (don't push yet). On each pointer-move tick while dragging, hit-test under the cursor and mutate a local in-progress scene (held in a ref, not pushed to `history`) by removing hit elements — this is the same "don't push until the gesture ends" rule already used for drawing a shape. On pointer-up, if anything was actually erased, call `pushSnapshot` once with the final post-erase scene. Net effect: dragging the eraser over 12 shapes is **one** undo step that restores all 12, matching how a single rectangle-drag is one undo step — not 12 separate snapshots. (An earlier draft of this plan specified one snapshot per erased element; that contradicted the single-drag-is-one-undo-step rule and would make erasing feel broken relative to every other tool, so it's corrected here.)

- [ ] **Step 4: Add tests for the remaining hook behaviors**

Extend `tests/tools/brainstorm-persistence.test.tsx` or add sibling test files for: undo/redo wiring (draw two shapes, undo once, scene has one), duplicate offset, delete-on-keypress is exercised at the component level in Task 11 since keyboard listeners are typically attached in `index.tsx`, not the hook — confirm in Step 3's implementation which layer owns the `keydown` listener and put the corresponding test there instead of duplicating.

- [ ] **Step 5: Run full suite**

```bash
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add components/tools/Brainstorm/useBrainstorm.ts tests/tools/brainstorm-persistence.test.tsx
git commit -m "feat(brainstorm): useBrainstorm hook — scene/history/viewport state and pointer handlers"
```

---

### Task 10: `components/tools/Brainstorm/Toolbar.tsx`

**Files:**
- Create: `components/tools/Brainstorm/Toolbar.tsx`

A presentational component — no new logic, just wiring existing `@/components/ui/*` primitives (`Button`, `Input` etc., matching every other tool's UI layer) to the hook's exposed setters. No dedicated unit test file for this task; it's covered by the component-level interaction tests in Task 11 (e.g. "clicking the rectangle tool button sets the active tool").

- [ ] **Step 1: Implement `Toolbar.tsx`**

Props: `{ tool, setTool, strokeColor, setStrokeColor, fillColor, setFillColor, strokeWidth, setStrokeWidth, zoom, onZoomIn, onZoomOut, onUndo, onRedo, canUndo, canRedo, onExportPng, onExportJson, onImportJson, onClear }`. Render: a row of tool-select buttons (select/pen/rectangle/ellipse/line/arrow/text/eraser) with the active one visually indicated (`aria-pressed`), a color input for stroke, a color input for fill, a stroke-width number input, zoom percentage display with +/- buttons, undo/redo buttons (disabled per `canUndo`/`canRedo`), and an overflow/menu group for export PNG, export JSON, import JSON (hidden `<input type="file">` triggered by a visible button — the spec's "import JSON" interaction), and clear (gated behind a `confirm()` or an inline confirm state — clearing the whole board is destructive and should not be a single accidental click).

- [ ] **Step 2: Commit**

```bash
git add components/tools/Brainstorm/Toolbar.tsx
git commit -m "feat(brainstorm): toolbar UI for tool/color/zoom/undo/export controls"
```

(Verification of this component happens in Task 11's interaction tests and Task 12's manual QA pass — there is no isolated automated check worth writing for a pure layout component with no branching logic of its own.)

---

### Task 11: `components/tools/Brainstorm/index.tsx` + component interaction tests + registry entry

**Files:**
- Create: `components/tools/Brainstorm/index.tsx`
- Create: `tests/tools/brainstorm.test.tsx`
- Modify: `lib/tools.config.ts`

- [ ] **Step 1: Implement `index.tsx`**

Owns: the `<canvas>` ref sized to its container via a `ResizeObserver` (polyfilled in Task 1) so the canvas backing store matches the displayed size at the device pixel ratio; a `requestAnimationFrame` loop that calls `render.drawScene` whenever `scene`/`viewport` change (use a "dirty" ref flag set by the hook's state changes, cleared after each draw, rather than redrawing every single rAF tick unconditionally — this avoids burning CPU when the board is idle); pointer event wiring (`onPointerDown/Move/Up` calling into `useBrainstorm`'s handlers, with `setPointerCapture` on pointer-down so drags tracked outside the canvas bounds still resolve, per Task 1's polyfill); keyboard wiring (`Delete`/`Backspace`, `Ctrl/Cmd+D`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`) attached via a `useEffect` on `window` with cleanup; `Toolbar` rendered above the canvas with all the hook's state/handlers passed through; export-PNG and export/import-JSON wired to `lib/brainstorm/serialize.ts` and a hidden download `<a>`/file `<input>`.

**Text tool overlay (spec line 144 — "an overlay `<textarea>` positioned in world coords"):** this is its own piece of state in `index.tsx`, not the hook — it's a DOM-positioning concern, not scene logic. When the `text` tool is active and the user clicks the canvas, store `{ worldX, worldY }` for the pending caret in local state and render an absolutely-positioned `<textarea>` *outside* the canvas (a sibling `<div>` overlaying it) whose `style.left`/`style.top` are computed every render as `viewport.worldToScreen({ x: worldX, y: worldY }, viewport)` and whose `style.fontSize` is `fontSize * viewport.zoom`. Because this recomputation happens on every render of `index.tsx`, and `index.tsx` re-renders whenever `viewport` changes (pan/zoom), the textarea stays visually pinned to its world position automatically — there is no separate "reposition on pan" handler to write, as long as the textarea's position is derived from `viewport` in the render body rather than captured once at creation time. On blur (or `Escape`/`Enter`-without-shift), commit the textarea's value as a new `TextElement` via the hook and clear the pending-caret state; an empty textarea on blur commits nothing.

`"use client"` directive at the top, matching every other tool component. Default export, matching the `component: () => import(...)` contract in `tools.config.ts`.

- [ ] **Step 2: Write component interaction tests**

Create `tests/tools/brainstorm.test.tsx` following the existing pattern from `tests/tools/qr-code-generator.test.tsx` (render via `@testing-library/react`, `fireEvent`). Cover, at minimum:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Brainstorm from "@/components/tools/Brainstorm";

describe("Brainstorm", () => {
  it("renders a canvas and a toolbar", () => {
    render(<Brainstorm />);
    expect(document.querySelector("canvas")).toBeInTheDocument();
  });

  it("selecting the rectangle tool then dragging on the canvas commits a rectangle, and undo removes it", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /rectangle/i }));
    const canvas = document.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 80 });
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 80 });
    // Assert via whatever observable side effect index.tsx exposes — e.g. an
    // element-count badge in the toolbar, or the undo button's disabled state
    // flipping from disabled to enabled, since the canvas's pixels aren't
    // inspectable through the FakeCanvasRenderingContext2D stub.
    expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
  });

  it("Delete key removes the selected element", () => {
    // draw a shape, click select tool, click the shape to select it, press Delete,
    // assert undo is now the only way back (i.e. an element existed and was removed)
  });

  it("clicking export JSON triggers a download without throwing", () => {
    render(<Brainstorm />);
    // jsdom doesn't implement real navigation on <a download>; assert the
    // click handler runs without throwing and that toJSON was called with
    // the current scene — spy on lib/brainstorm/serialize if needed.
  });

  it("importing a valid JSON file replaces the scene", () => {
    // construct a File with valid Scene JSON, fire a change event on the
    // hidden file input, assert the scene updates (e.g. undo becomes enabled
    // or an element-count indicator changes)
  });

  it("importing malformed JSON shows an error and does not crash", () => {
    // fire a change event with invalid JSON text, assert an error message
    // renders and the canvas/toolbar are still interactive afterward
  });
});
```

Note: exact assertions depend on what observable UI state `index.tsx`/`Toolbar.tsx` end up exposing (e.g. whether there's a visible element count). Write the implementation in Step 1 with at least one such observable affordance specifically so these tests aren't reduced to "doesn't throw."

- [ ] **Step 3: Run to confirm failure, then implement until green**

```bash
pnpm test tests/tools/brainstorm.test.tsx
```

- [ ] **Step 4: Register in `lib/tools.config.ts`**

Add the import near the other thumbnail imports:

```ts
import brainstormThumbnail from "@/public/thumbs/uuid.png"; // placeholder, see plan note on thumbnail reuse
```

Add an entry to the `tools` array (placement alphabetical-by-insertion doesn't matter — `toolSummaries` sorts by title at build time):

```ts
{
  slug: "brainstorm",
  title: "Brainstorm",
  description: "An infinite, hand-drawn whiteboard for sketching ideas — pen, shapes, text, and more.",
  tags: ["whiteboard", "drawing", "sketch", "diagram", "brainstorm", "excalidraw alternative", "online whiteboard free"],
  thumbnail: brainstormThumbnail,
  icon: "pencil-ruler",
  component: () => import("@/components/tools/Brainstorm"),
},
```

- [ ] **Step 5: Run full suite and build**

```bash
pnpm test
pnpm build 2>&1 | tail -10
```

Expected: all tests pass; zero type errors.

- [ ] **Step 6: Commit**

```bash
git add components/tools/Brainstorm/index.tsx tests/tools/brainstorm.test.tsx lib/tools.config.ts
git commit -m "feat(brainstorm): canvas orchestration component and tool gallery registration"
```

---

### Task 12: Final verification

- [ ] **Step 1: Full pre-commit gate**

```bash
pnpm test && pnpm build && pnpm lint
```

Expected: zero failures across all three (per CLAUDE.md's mandatory pre-commit checklist).

- [ ] **Step 2: Self-review the diff against CLAUDE.md's Banned Patterns table**

Specifically check: no `Math.random()` anywhere in `lib/brainstorm/` or `components/tools/Brainstorm/`; no `% n` applied to a `crypto.getRandomValues()` result; no new `fetch` calls (this tool has none by design — flag immediately if any sneaked in); no `<style>` tag without a nonce; no hardcoded secrets (none expected — this tool has no API keys).

- [ ] **Step 3: Verify the tool route renders**

```bash
pnpm dev &
DEV_PID=$!
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/tools/brainstorm
kill $DEV_PID
```

Expected: `200`

- [ ] **Step 4: Verify the tool appears in the gallery/search index**

```bash
pnpm dev &
DEV_PID=$!
sleep 6
curl -s http://localhost:3000 | grep -o "Brainstorm" | head -1
kill $DEV_PID
```

Expected: `Brainstorm`

- [ ] **Step 5: Manual QA pass against the spec's interaction table**

Automated tests cover logic and basic wiring but not visual/feel correctness for a canvas drawing tool. Run `pnpm dev`, open `/tools/brainstorm` in a browser, and manually walk every row of the spec's "Tools & Interactions" table (draw each shape type, pen, text via the overlay textarea, select + drag-move, resize via each corner handle, eraser drag, duplicate, delete, undo/redo, space-drag pan, trackpad scroll pan, ctrl+scroll zoom-to-cursor, pinch zoom if on a touch device) plus: reload the page and confirm the board auto-restored from `localStorage`; export PNG and open the downloaded file; export JSON, clear the board, import the JSON back and confirm it matches.

- [ ] **Step 6: Open a PR from `development` → `main`**

```bash
git push origin development
gh pr create --base main --head development --title "feat: Brainstorm whiteboard tool" --body "Implements the Brainstorm whiteboard per docs/superpowers/specs/2026-07-01-brainstorm-whiteboard-design.md. See plan: docs/superpowers/plans/2026-07-01-brainstorm-whiteboard.md"
```

Expected: PR created with passing CI (tests + build + lint), no direct commits to `main`.
