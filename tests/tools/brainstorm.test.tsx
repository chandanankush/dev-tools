import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Brainstorm from "@/components/tools/Brainstorm";

beforeEach(() => {
  localStorage.clear();
});

function getCanvas(): HTMLCanvasElement {
  return document.querySelector("canvas") as HTMLCanvasElement;
}

describe("Brainstorm", () => {
  it("renders a canvas and a toolbar", () => {
    render(<Brainstorm />);
    expect(getCanvas()).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /tools/i })).toBeInTheDocument();
  });

  it("selecting the rectangle tool then dragging on the canvas commits a shape, and undo removes it", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^rectangle$/i }));
    const canvas = getCanvas();

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 80 });
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 80 });

    const undoButton = screen.getByRole("button", { name: /undo/i });
    expect(undoButton).toBeEnabled();
    fireEvent.click(undoButton);
    expect(undoButton).toBeDisabled();
  });

  it("Delete key removes the selected element", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^rectangle$/i }));
    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40 });

    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20 });

    const deleteButton = screen.getByRole("button", { name: /delete selection/i });
    expect(deleteButton).toBeEnabled();

    fireEvent.keyDown(window, { key: "Delete" });
    expect(deleteButton).toBeDisabled();

    // The deletion itself is one more undo step, on top of the original draw.
    const undoButton = screen.getByRole("button", { name: /undo/i });
    expect(undoButton).toBeEnabled();
  });

  it("Ctrl+D duplicates the selected element", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^rectangle$/i }));
    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20 });

    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10 });

    const duplicateButton = screen.getByRole("button", { name: /duplicate selection/i });
    expect(duplicateButton).toBeEnabled();
    fireEvent.keyDown(window, { key: "d", ctrlKey: true });

    // Two undo-able states now exist: the original draw, plus the duplicate.
    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.click(undoButton); // undo duplicate
    expect(undoButton).toBeEnabled(); // original draw still undo-able
  });

  it("Ctrl+Z / Ctrl+Shift+Z drive undo/redo", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^rectangle$/i }));
    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20 });

    const undoButton = screen.getByRole("button", { name: /undo/i });
    const redoButton = screen.getByRole("button", { name: /redo/i });
    expect(undoButton).toBeEnabled();
    expect(redoButton).toBeDisabled();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeEnabled();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(undoButton).toBeEnabled();
  });

  it("clicking export JSON triggers a download without throwing", () => {
    render(<Brainstorm />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: /export json/i }))).not.toThrow();
  });

  it("clicking export PNG triggers a download without throwing", async () => {
    render(<Brainstorm />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: /export png/i }))).not.toThrow();
  });

  it("importing a valid JSON file replaces the scene", async () => {
    render(<Brainstorm />);
    const validScene = JSON.stringify({
      version: 1,
      elements: [
        { id: "imported-1", type: "rectangle", x: 0, y: 0, w: 5, h: 5, strokeColor: "#000", strokeWidth: 1, fillColor: null, seed: 1 },
      ],
    });
    const file = new File([validScene], "scene.json", { type: "application/json" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    // findByRole only waits for the element to exist — it exists (disabled)
    // from the first render, so it resolves before FileReader's async
    // onload fires. waitFor on the actual enabled-state assertion is what
    // correctly waits for the import to land.
    await waitFor(() => expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("importing malformed JSON shows an error and does not crash", async () => {
    render(<Brainstorm />);
    const file = new File(["{not json"], "bad.json", { type: "application/json" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // The canvas/toolbar are still interactive afterward.
    expect(screen.getByRole("button", { name: /^select$/i })).toBeEnabled();
  });

  it("the text tool places a textarea overlay that commits a text element on blur", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^text$/i }));
    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 });

    const overlay = screen.getByLabelText(/text element editor/i);
    fireEvent.change(overlay, { target: { value: "hello board" } });
    fireEvent.blur(overlay);

    expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled();
    expect(screen.queryByLabelText(/text element editor/i)).not.toBeInTheDocument();
  });

  it("the text tool overlay commits nothing on blur if left empty", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^text$/i }));
    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 });
    const overlay = screen.getByLabelText(/text element editor/i);
    fireEvent.blur(overlay);
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
  });

  it("suppresses the canvas mousedown default so it cannot steal focus from the text overlay", () => {
    // Regression: the canvas is not focusable, so an un-prevented mousedown
    // moves focus to <body>, blurring the just-opened text overlay and
    // committing it empty before a character can be typed. fireEvent returns
    // false when the handler called preventDefault().
    render(<Brainstorm />);
    const canvas = getCanvas();
    const notPrevented = fireEvent.mouseDown(canvas, { clientX: 30, clientY: 30 });
    expect(notPrevented).toBe(false);
  });

  it("Clear requires a second confirming click before wiping the board", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^rectangle$/i }));
    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20 });

    const clearButton = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearButton); // first click only arms confirmation
    expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /click again to confirm/i }));
    expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled(); // clear itself is one more undo step
  });
});

describe("Brainstorm tool registry", () => {
  it("is registered in lib/tools.config.ts", async () => {
    const { getToolBySlug } = await import("@/lib/tools.config");
    const tool = getToolBySlug("brainstorm");
    expect(tool).toBeDefined();
    expect(tool?.title).toBe("Brainstorm");
    const mod = await tool!.component();
    expect(mod.default).toBeDefined();
  });

  it("appears in the gallery's toolSummaries", async () => {
    const { toolSummaries } = await import("@/lib/tools.config");
    expect(toolSummaries.some((t) => t.slug === "brainstorm")).toBe(true);
  });
});
