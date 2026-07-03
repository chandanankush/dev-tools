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

  it("clicking outside an active text overlay finalizes it in place without opening a new box", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^text$/i }));
    const canvas = getCanvas();

    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.change(screen.getByLabelText(/text element editor/i), { target: { value: "First" } });

    // Click on empty canvas elsewhere: commits the current text and closes the
    // overlay — it must NOT reopen a fresh overlay at the new point.
    fireEvent.pointerDown(canvas, { clientX: 300, clientY: 300 });

    expect(screen.queryByLabelText(/text element editor/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled();
  });

  it("clicking inside an existing text object reopens it for editing instead of stacking a new one", () => {
    const { container } = render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^text$/i }));
    const canvas = getCanvas();

    // Create a text element at (40, 40).
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.change(screen.getByLabelText(/text element editor/i), { target: { value: "hello" } });
    fireEvent.blur(screen.getByLabelText(/text element editor/i));
    expect(container.querySelector("[data-element-count]")).toHaveAttribute("data-element-count", "1");

    // Click inside its bounds: reopens the same text, does not add a new one.
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 48 });
    const overlay = screen.getByLabelText(/text element editor/i) as HTMLTextAreaElement;
    expect(overlay.value).toBe("hello");

    // Editing and committing updates in place — still a single element.
    fireEvent.change(overlay, { target: { value: "hello world" } });
    fireEvent.blur(overlay);
    expect(container.querySelector("[data-element-count]")).toHaveAttribute("data-element-count", "1");
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

describe("Brainstorm multi-selection", () => {
  function elementCount(container: HTMLElement): number {
    return Number(container.querySelector("[data-element-count]")?.getAttribute("data-element-count"));
  }

  function drawRect(canvas: HTMLCanvasElement, x1: number, y1: number, x2: number, y2: number) {
    fireEvent.click(screen.getByRole("button", { name: /^rectangle$/i }));
    fireEvent.pointerDown(canvas, { clientX: x1, clientY: y1 });
    fireEvent.pointerMove(canvas, { clientX: x2, clientY: y2 });
    fireEvent.pointerUp(canvas, { clientX: x2, clientY: y2 });
  }

  function marquee(canvas: HTMLCanvasElement, x1: number, y1: number, x2: number, y2: number) {
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.pointerDown(canvas, { clientX: x1, clientY: y1 });
    fireEvent.pointerMove(canvas, { clientX: x2, clientY: y2 });
    fireEvent.pointerUp(canvas, { clientX: x2, clientY: y2 });
  }

  it("marquee selects every intersecting object and Delete removes the whole group", () => {
    const { container } = render(<Brainstorm />);
    const canvas = getCanvas();
    drawRect(canvas, 20, 20, 60, 60);
    drawRect(canvas, 120, 120, 160, 160);
    expect(elementCount(container)).toBe(2);

    marquee(canvas, 5, 5, 200, 200);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(elementCount(container)).toBe(0);
  });

  it("a sub-threshold click on empty canvas clears the selection", () => {
    render(<Brainstorm />);
    const canvas = getCanvas();
    drawRect(canvas, 20, 20, 60, 60);

    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 }); // select the rect
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40 });
    expect(screen.getByRole("button", { name: /delete selection/i })).toBeEnabled();

    fireEvent.pointerDown(canvas, { clientX: 300, clientY: 300 }); // click empty, no drag
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 300 });
    expect(screen.getByRole("button", { name: /delete selection/i })).toBeDisabled();
  });

  it("clicking a single object selects only it", () => {
    const { container } = render(<Brainstorm />);
    const canvas = getCanvas();
    drawRect(canvas, 20, 20, 60, 60);
    drawRect(canvas, 120, 120, 160, 160);

    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 }); // hits only the first rect
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40 });

    fireEvent.keyDown(window, { key: "Delete" });
    expect(elementCount(container)).toBe(1); // only the clicked one was removed
  });

  it("copy then paste adds an offset, selected duplicate of the group", () => {
    const { container } = render(<Brainstorm />);
    const canvas = getCanvas();
    drawRect(canvas, 20, 20, 60, 60);
    drawRect(canvas, 120, 120, 160, 160);

    marquee(canvas, 5, 5, 200, 200);
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    expect(elementCount(container)).toBe(4);

    // The pasted clones are the current selection — deleting removes only them.
    fireEvent.keyDown(window, { key: "Delete" });
    expect(elementCount(container)).toBe(2);
  });

  it("cut removes the selected group and paste brings it back", () => {
    const { container } = render(<Brainstorm />);
    const canvas = getCanvas();
    drawRect(canvas, 20, 20, 60, 60);
    drawRect(canvas, 120, 120, 160, 160);

    marquee(canvas, 5, 5, 200, 200);
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });
    expect(elementCount(container)).toBe(0);

    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    expect(elementCount(container)).toBe(2);
  });
});

describe("Brainstorm hand tool", () => {
  function drawRect(canvas: HTMLCanvasElement, x1: number, y1: number, x2: number, y2: number) {
    fireEvent.click(screen.getByRole("button", { name: /^rectangle$/i }));
    fireEvent.pointerDown(canvas, { clientX: x1, clientY: y1 });
    fireEvent.pointerMove(canvas, { clientX: x2, clientY: y2 });
    fireEvent.pointerUp(canvas, { clientX: x2, clientY: y2 });
  }

  it("appears in the toolbar and shows a grab cursor when active", () => {
    render(<Brainstorm />);
    fireEvent.click(screen.getByRole("button", { name: /^hand$/i }));
    expect(getCanvas().className).toMatch(/cursor-grab/);
  });

  it("clicking an object with the hand tool does not select it", () => {
    render(<Brainstorm />);
    const canvas = getCanvas();
    drawRect(canvas, 20, 20, 80, 80);

    fireEvent.click(screen.getByRole("button", { name: /^hand$/i }));
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40 });

    expect(screen.getByRole("button", { name: /delete selection/i })).toBeDisabled();
  });

  it("panning preserves the existing selection and creates no history", () => {
    render(<Brainstorm />);
    const canvas = getCanvas();
    drawRect(canvas, 20, 20, 80, 80);

    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40 });
    const deleteBtn = screen.getByRole("button", { name: /delete selection/i });
    expect(deleteBtn).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /^hand$/i }));
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerMove(canvas, { clientX: 140, clientY: 120 });
    fireEvent.pointerUp(canvas, { clientX: 140, clientY: 120 });

    expect(deleteBtn).toBeEnabled(); // selection survived the pan

    // The pan added no history: a single undo removes the draw, leaving nothing.
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
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
