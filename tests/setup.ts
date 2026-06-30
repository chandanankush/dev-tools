import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";

vi.mock("next/image", () => ({
  default: ({ alt, src, priority, ...props }: { alt: string; src: string; priority?: boolean } & Record<string, unknown>) => {
    void priority;
    return createElement("img", { alt, src, ...props });
  },
}));

// jsdom has no canvas 2D implementation at all. roughjs's RoughCanvas does
// `this.ctx = this.canvas.getContext('2d')` internally — it re-derives the
// context from the canvas element rather than using whatever ctx a caller
// passes around — so `ctx.canvas` must be a real <canvas> element whose own
// `getContext` resolves back to an equivalent fake context, not a plain
// object literal (confirmed against roughjs 4.6.6's bin/canvas.js).
class FakeCanvasRenderingContext2D {
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
  measureText = vi.fn(() => ({ width: 0 }) as TextMetrics);
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
HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => cb(new Blob()));
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
