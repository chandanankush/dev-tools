import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";

// ── react-markdown / remark-gfm mocks ─────────────────────────────────────────
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) =>
    createElement("div", { "data-testid": "md-preview" }, children),
}));
vi.mock("remark-gfm", () => ({ default: {} }));

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

// react-to-pdf must be mocked — html2canvas needs real layout/canvas absent in jsdom.
const { generatePDFMock } = vi.hoisted(() => ({ generatePDFMock: vi.fn() }));
vi.mock("react-to-pdf", () => ({
  __esModule: true,
  default: generatePDFMock,
  Resolution: { HIGH: 2 },
}));

import EditorPad, { MAX_NOTE_CHARS, MAX_TOTAL_CHARS, clampToLimits, forceLightStyles, computePdfRenderPlan } from "@/components/tools/EditorPad";

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
  generatePDFMock.mockReset();
  generatePDFMock.mockResolvedValue(undefined);
  vi.stubGlobal("localStorage", localStorageMock);
  vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid-1234-5678-abcd-ef0123456789" as ReturnType<typeof crypto.randomUUID>);
});

describe("EditorPad", () => {
  it("renders the notes sidebar and a default note", () => {
    render(<EditorPad />);
    expect(screen.getAllByTitle("New note")[0]).toBeInTheDocument();
    // default note title uses DD-MM-YY HH:MM:SS format
    const noteTitles = screen.getAllByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(noteTitles.length).toBeGreaterThan(0);
  });

  it("creates a new note when + is clicked", () => {
    render(<EditorPad />);
    const before = screen.getAllByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).length;
    fireEvent.click(screen.getAllByTitle("New note")[0]);
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

  it("rich editor container is vertically scrollable for overflowing content", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("Rich"));
    const richContainer = document.getElementById("pdf-target-rich");
    expect(richContainer).not.toBeNull();
    expect(richContainer?.className).toContain("overflow-y-auto");
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

  it("word wrap toggle is shown in plain mode, hidden in rich mode, and toggles with markdown sub-view", () => {
    render(<EditorPad />);
    expect(screen.getByText("Wrap")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Rich"));
    expect(screen.queryByText("Wrap")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("MD"));
    // Write sub-view (default) — wrap should be visible
    expect(screen.getByText("Wrap")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Preview"));
    // Preview sub-view — wrap should be hidden
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
    // The mobile header also shows the title, so use getAllByText and target the sidebar <p>
    const titleEls = screen.getAllByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const titleEl = titleEls[titleEls.length - 1]; // sidebar <p> with onDoubleClick
    const originalTitle = titleEl.textContent!;
    fireEvent.doubleClick(titleEl);

    const input = screen.getByDisplayValue(originalTitle);
    fireEvent.change(input, { target: { value: "My Note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getAllByText("My Note").length).toBeGreaterThan(0);
  });

  it("inline rename: Escape cancels without saving", () => {
    render(<EditorPad />);
    const titleEls = screen.getAllByText(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const titleEl = titleEls[titleEls.length - 1]; // sidebar <p> with onDoubleClick
    const originalTitle = titleEl.textContent!;
    fireEvent.doubleClick(titleEl);

    const input = screen.getByDisplayValue(originalTitle);
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // Title should revert to original timestamp
    expect(screen.getAllByText(originalTitle).length).toBeGreaterThan(0);
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

describe("EditorPad — Markdown mode", () => {
  it("renders MD button in the mode toggle", () => {
    render(<EditorPad />);
    expect(screen.getByText("MD")).toBeInTheDocument();
  });

  it("switches to markdown mode and shows 'Markdown' in status bar", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    expect(screen.getByText("Markdown")).toBeInTheDocument();
  });

  it("shows Write/Preview sub-toggle when in markdown mode", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    expect(screen.getByText("Write")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("shows the markdown textarea (Write pane) by default", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    expect(screen.getByPlaceholderText("Write markdown here…")).toBeInTheDocument();
  });

  it("clicking Preview hides textarea and shows rendered preview", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    fireEvent.click(screen.getByText("Preview"));
    expect(screen.getByTestId("md-preview")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write markdown here…")).not.toBeInTheDocument();
  });

  it("typed markdown content auto-saves to localStorage after debounce", async () => {
    vi.useFakeTimers();
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));

    const textarea = screen.getByPlaceholderText("Write markdown here…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "# Hello markdown" } });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const stored = JSON.parse(localStorageMock.getItem("editorpad-notes") ?? "[]") as { content: string; mode: string }[];
    expect(stored[0]?.content).toBe("# Hello markdown");
    expect(stored[0]?.mode).toBe("markdown");
    vi.useRealTimers();
  });

  it("updates word count from raw markdown content", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    const textarea = screen.getByPlaceholderText("Write markdown here…");
    // "# Hello World" splits to 3 tokens: "#", "Hello", "World"
    fireEvent.change(textarea, { target: { value: "# Hello World" } });
    expect(screen.getByText("3 words")).toBeInTheDocument();
  });

  it("switching plain → markdown keeps plain content intact", () => {
    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "original content" } });
    fireEvent.click(screen.getByText("MD"));
    expect(screen.getByPlaceholderText("Write markdown here…")).toHaveValue("original content");
  });

  it("switching markdown → plain keeps raw markdown as plain content", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    const mdTextarea = screen.getByPlaceholderText("Write markdown here…") as HTMLTextAreaElement;
    fireEvent.change(mdTextarea, { target: { value: "**bold** text" } });
    fireEvent.click(screen.getByText("Plain"));
    expect(screen.getByPlaceholderText("Start typing…")).toHaveValue("**bold** text");
  });

  it("switching markdown → rich removes textarea and shows Rich text status", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    fireEvent.click(screen.getByText("Rich"));
    expect(screen.getByText("Rich text")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write markdown here…")).not.toBeInTheDocument();
  });

  it("replace-all works in markdown mode", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    const textarea = screen.getByPlaceholderText("Write markdown here…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "foo bar foo" } });

    fireEvent.click(screen.getByTitle("Find & Replace (Ctrl+H)"));
    fireEvent.change(screen.getByPlaceholderText("Find…"), { target: { value: "foo" } });
    fireEvent.change(screen.getByPlaceholderText("Replace with…"), { target: { value: "baz" } });
    fireEvent.click(screen.getByText("Replace All"));

    expect(textarea.value).toBe("baz bar baz");
  });

  it("download tooltip shows 'Download as .md' in markdown mode", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    expect(screen.getByTitle("Download as .md")).toBeInTheDocument();
  });

  it("trims pasted markdown that exceeds the per-note limit and warns the user", () => {
    render(<EditorPad />);
    fireEvent.click(screen.getByText("MD"));
    const textarea = screen.getByPlaceholderText("Write markdown here…") as HTMLTextAreaElement;
    const oversized = "m".repeat(MAX_NOTE_CHARS + 50);

    fireEvent.change(textarea, { target: { value: oversized } });

    expect(textarea.value.length).toBe(MAX_NOTE_CHARS);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/limit/i);
  });

  it("uploading a .md file auto-switches note to markdown mode", async () => {
    // FileReader.readAsText is async in jsdom — mock it to fire onload synchronously
    const originalFileReader = global.FileReader;
    class SyncFileReader {
      onload: ((ev: { target: { result: string } }) => void) | null = null;
      readAsText(_file: File) {
        this.onload?.({ target: { result: "# Hello from file" } });
      }
    }
    vi.stubGlobal("FileReader", SyncFileReader);

    render(<EditorPad />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mdFile = new File(["# Hello from file"], "readme.md", { type: "text/markdown" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mdFile] } });
    });

    expect(screen.getByText("Markdown")).toBeInTheDocument();

    vi.stubGlobal("FileReader", originalFileReader);
  });
});

describe("forceLightStyles — PDF export gets readable dark text", () => {
  it("sets explicit dark inline colors on every element so dark-mode text is not white-on-white", () => {
    const root = document.createElement("div");
    root.innerHTML = "<h1>title</h1><p>body</p><blockquote>quote</blockquote><code>x</code><a href='#'>link</a>";
    forceLightStyles(root);

    const h1 = root.querySelector("h1") as HTMLElement;
    const bq = root.querySelector("blockquote") as HTMLElement;
    const code = root.querySelector("code") as HTMLElement;

    expect(h1.style.color).not.toBe("");          // forced, not inherited from theme
    expect(root.style.color).not.toBe("");
    expect(bq.style.color).not.toBe(h1.style.color); // blockquote visually distinct
    expect(code.style.backgroundColor).not.toBe("");  // code keeps a light background
  });
});

describe("computePdfRenderPlan — fits long notes within canvas limits", () => {
  it("keeps full quality (max scale) and no truncation for a short note", () => {
    const plan = computePdfRenderPlan(1000);
    expect(plan.truncated).toBe(false);
    expect(plan.renderHeight).toBe(1000);
    expect(plan.scale).toBe(7); // PDF_SCALE_MAX — short notes stay crisp
  });

  it("lowers the scale (not blank) for a mid-length note without truncating", () => {
    const plan = computePdfRenderPlan(5600);
    expect(plan.truncated).toBe(false);
    expect(plan.renderHeight).toBe(5600);
    expect(plan.scale).toBeLessThan(7);
    expect(plan.scale).toBeGreaterThanOrEqual(2);
  });

  it("truncates an oversized note to a safe height and never goes below the scale floor", () => {
    const plan = computePdfRenderPlan(54040); // the RAG-roadmap case
    expect(plan.truncated).toBe(true);
    expect(plan.renderHeight).toBeLessThan(54040);
    expect(plan.renderHeight * plan.scale).toBeLessThanOrEqual(16384); // within canvas limit
    expect(plan.scale).toBe(2); // PDF_SCALE_FLOOR
    expect(plan.estimatedPages).toBeGreaterThan(0);
  });
});

describe("EditorPad — PDF export spinner", () => {
  it("shows a spinner while the PDF is generating and clears it when done", async () => {
    let resolvePdf!: () => void;
    generatePDFMock.mockReturnValue(new Promise<void>((r) => { resolvePdf = r; }));

    render(<EditorPad />);
    fireEvent.change(screen.getByPlaceholderText("Start typing…"), { target: { value: "hello" } });

    await act(async () => {
      fireEvent.click(screen.getByTitle("Download as PDF"));
    });

    expect(screen.getByLabelText("Generating PDF")).toBeInTheDocument();

    await act(async () => {
      resolvePdf();
    });

    expect(screen.queryByLabelText("Generating PDF")).not.toBeInTheDocument();
  });
});

describe("clampToLimits — never destroys existing data", () => {
  it("returns content unchanged when within limits", () => {
    expect(clampToLimits("ab", "abc", 0)).toEqual({ value: "abc", notice: null });
  });

  it("trims growth down to the per-note cap for a normal note", () => {
    const res = clampToLimits("a".repeat(100), "a".repeat(MAX_NOTE_CHARS + 50), 0);
    expect(res.value.length).toBe(MAX_NOTE_CHARS);
    expect(res.notice).toMatch(/limit/i);
  });

  it("keeps existing chars and blocks growth for a note already over the per-note cap", () => {
    const current = "x".repeat(MAX_NOTE_CHARS + 100);
    const res = clampToLimits(current, current + "y", 0);
    expect(res.value).toBe(current); // existing data preserved, only the new char dropped
    expect(res.notice).toMatch(/limit/i);
  });

  it("does NOT wipe a note when other notes already exceed the aggregate cap", () => {
    const current = "keep this";
    const res = clampToLimits(current, current + " and more", MAX_TOTAL_CHARS + 1000);
    expect(res.value).toBe(current); // must not become empty
    expect(res.notice).toMatch(/storage/i);
  });

  it("always allows shrinking, even from an over-limit note", () => {
    const current = "x".repeat(MAX_NOTE_CHARS + 100);
    const res = clampToLimits(current, "x".repeat(50), MAX_TOTAL_CHARS + 1000);
    expect(res.value).toBe("x".repeat(50)); // deletion never blocked
    expect(res.notice).toBeNull();
  });
});

describe("EditorPad — character limits", () => {
  it("trims pasted plain text that exceeds the per-note limit", () => {
    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…") as HTMLTextAreaElement;
    const oversized = "a".repeat(MAX_NOTE_CHARS + 100);

    fireEvent.change(textarea, { target: { value: oversized } });

    expect(textarea.value.length).toBe(MAX_NOTE_CHARS);
  });

  it("shows a dismissible warning when content is trimmed", () => {
    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "a".repeat(MAX_NOTE_CHARS + 1) } });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/limit/i);

    fireEvent.click(screen.getByTitle("Dismiss notice"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not warn for content within the limit", () => {
    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "well within bounds" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(textarea.value).toBe("well within bounds");
  });

  it("highlights the character counter once the per-note limit is reached", () => {
    render(<EditorPad />);
    const textarea = screen.getByPlaceholderText("Start typing…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "a".repeat(MAX_NOTE_CHARS + 10) } });

    const counter = screen.getByText(`${MAX_NOTE_CHARS} chars`);
    expect(counter.className).toContain("text-destructive");
  });
});
