import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Tiptap must be mocked — jsdom lacks full ProseMirror DOM support ──────────
vi.mock("@tiptap/react", () => ({
  useEditor: () => null,
  EditorContent: () => null,
}));
vi.mock("@tiptap/starter-kit", () => ({ default: {} }));
vi.mock("@tiptap/extension-underline", () => ({ default: {} }));
vi.mock("@tiptap/extension-link", () => ({ default: { configure: () => ({}) } }));
// In Tiptap v3, table extensions are named exports from the main table package
vi.mock("@tiptap/extension-table", () => ({
  Table: { configure: () => ({}) },
  TableRow: {},
  TableCell: {},
  TableHeader: {},
}));
// TextStyle is a named export in Tiptap v3
vi.mock("@tiptap/extension-text-style", () => ({ TextStyle: {} }));
vi.mock("@tiptap/extension-text-align", () => ({ default: { configure: () => ({}) } }));

import EditorPad from "@/components/tools/EditorPad";

// ── localStorage stub ──────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal("localStorage", localStorageMock);
  vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid-1234-5678-abcd-ef0123456789" as ReturnType<typeof crypto.randomUUID>);
});

describe("EditorPad", () => {
  it("renders the notes sidebar and a default note", () => {
    render(<EditorPad />);
    expect(screen.getByTitle("New note")).toBeInTheDocument();
    // default note title uses DD-MM-YY HH:MM:SS format
    const noteTitles = screen.getAllByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(noteTitles.length).toBeGreaterThan(0);
  });

  it("creates a new note when + is clicked", () => {
    render(<EditorPad />);
    const before = screen.getAllByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).length;
    fireEvent.click(screen.getByTitle("New note"));
    expect(screen.getAllByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).length).toBeGreaterThan(before);
  });

  it("deletes a note when trash icon is clicked", () => {
    render(<EditorPad />);
    // Hover to reveal delete — testing-library does not simulate hover CSS
    // so we look for the button directly (opacity-0 but present in DOM)
    const deleteBtn = screen.getByTitle("Delete note");
    fireEvent.click(deleteBtn);
    // After deleting the only note, the editor shows an empty-state message
    expect(screen.getByText("Create a note to start writing.")).toBeInTheDocument();
  });

  it("shows plain-text textarea in plain mode (default)", () => {
    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…");
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("persists typed content via auto-save", async () => {
    vi.useFakeTimers();
    render(<EditorPad />);

    const textarea = screen.getByPlaceholderText("Start typing…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Hello EditorPad" } });

    await act(async () => {
      vi.advanceTimersByTime(600); // past DEBOUNCE_MS
    });

    const stored = JSON.parse(localStorageMock.getItem("editorpad-notes") ?? "[]") as { content: string }[];
    expect(stored[0]?.content).toBe("Hello EditorPad");
    vi.useRealTimers();
  });

  it("updates word / char count in status bar", () => {
    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…");
    fireEvent.change(textarea, { target: { value: "hello world" } });
    expect(screen.getByText("2 words")).toBeInTheDocument();
    expect(screen.getByText("11 chars")).toBeInTheDocument();
  });

  it("shows 'Plain text' label in status bar by default", () => {
    render(<EditorPad />);
    expect(screen.getByText("Plain text")).toBeInTheDocument();
  });

  it("switches to rich mode when Rich button is clicked", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("Rich"));
    // In rich mode the textarea disappears and status shows Rich text
    expect(screen.getByText("Rich text")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Start typing…")).not.toBeInTheDocument();
  });

  it("shows Find & Replace panel when search icon is clicked", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByTitle("Find & Replace (Ctrl+H)"));
    expect(screen.getByPlaceholderText("Find…")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Replace with…")).toBeInTheDocument();
  });

  it("toggles Find & Replace panel with Ctrl+H", () => {
    render(<EditorPad />);
    fireEvent.keyDown(window, { key: "h", ctrlKey: true });
    expect(screen.getByPlaceholderText("Find…")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "h", ctrlKey: true });
    expect(screen.queryByPlaceholderText("Find…")).not.toBeInTheDocument();
  });

  it("performs replace-all in plain mode", () => {
    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "foo bar foo" } });

    fireEvent.click(screen.getByTitle("Find & Replace (Ctrl+H)"));
    fireEvent.change(screen.getByPlaceholderText("Find…"), { target: { value: "foo" } });
    fireEvent.change(screen.getByPlaceholderText("Replace with…"), { target: { value: "baz" } });
    fireEvent.click(screen.getByText("Replace All"));

    expect(textarea.value).toBe("baz bar baz");
  });

  it("copies text to clipboard when copy button is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…");
    fireEvent.change(textarea, { target: { value: "copy me" } });

    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy all text"));
    });

    expect(writeText).toHaveBeenCalledWith("copy me");
  });

  it("word wrap toggle button is shown only in plain mode", () => {
    render(<EditorPad />);
    expect(screen.getByText("Wrap")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Rich"));
    expect(screen.queryByText("Wrap")).not.toBeInTheDocument();
  });

  it("font size selector changes selection highlight", () => {
    render(<EditorPad />);
    const xlBtn = screen.getByText("XL");
    fireEvent.click(xlBtn);
    expect(xlBtn.className).toContain("bg-primary");
  });

  it("inline rename: double-click shows input; Enter commits", () => {
    render(<EditorPad />);
    // Note title is a timestamp string matching DD-MM-YY HH:MM:SS
    const titleEl = screen.getByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const originalTitle = titleEl.textContent!;
    fireEvent.doubleClick(titleEl);

    const input = screen.getByDisplayValue(originalTitle);
    fireEvent.change(input, { target: { value: "My Note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("My Note")).toBeInTheDocument();
  });

  it("inline rename: Escape cancels without saving", () => {
    render(<EditorPad />);
    const titleEl = screen.getByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const originalTitle = titleEl.textContent!;
    fireEvent.doubleClick(titleEl);

    const input = screen.getByDisplayValue(originalTitle);
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // Title should revert to original timestamp
    expect(screen.getByText(originalTitle)).toBeInTheDocument();
    expect(screen.queryByText("Changed")).not.toBeInTheDocument();
  });

  it("upload button triggers hidden file input click", () => {
    render(<EditorPad />);
    const uploadBtn = screen.getByTitle("Upload file (.txt, .md)");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy  = vi.spyOn(fileInput, "click");

    fireEvent.click(uploadBtn);
    expect(clickSpy).toHaveBeenCalled();
  });
});
