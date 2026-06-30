/**
 * EditorPad — multi-note browser notepad with plain text, rich text, and
 * Markdown modes.
 *
 * Persistence:
 * - All notes are stored in localStorage under `STORAGE_KEY`. `persistNotes`
 *   wraps the write in a try/catch so quota-exceeded errors in private browsing
 *   don't crash the component — the note is still visible in memory for the
 *   session.
 * - The active note ID is stored separately under `ACTIVE_KEY` so the user
 *   returns to the same note on reload.
 * - Auto-save is debounced by `DEBOUNCE_MS` (500 ms) to avoid writing on every
 *   keystroke. `saveTimerRef` holds the pending timeout ID so it can be
 *   cancelled on mode switch or unmount. An unmount cleanup effect (bare `useEffect`
 *   with empty deps) cancels any pending timer, preventing a state update on an
 *   unmounted component from the test suite.
 *
 * Tiptap (rich text) sync:
 * - `activeIdRef` mirrors `activeId` state in a ref so the Tiptap `onUpdate`
 *   callback can read the current active note ID without being captured in a
 *   stale closure. The ref is updated synchronously on every render.
 * - When the active note changes, the Tiptap editor content is synced inside
 *   a `setNotes` callback (functional update) so `notes` is not a dependency
 *   of the sync effect — if it were, every keystroke would trigger a re-sync.
 *   The `// eslint-disable-next-line` is intentional: we deliberately omit
 *   `notes` from the deps.
 *
 * Find & Replace:
 * - Plain text and Markdown use a simple string replace (safe — no HTML).
 * - Rich text uses `safeReplaceInHTML` which walks the parsed DOM's text nodes
 *   only, leaving tag names and attributes untouched. This prevents accidental
 *   replacement of HTML attribute values that happen to contain the search term.
 *
 * Mode switching:
 * - `switchToMode` attempts a lossless conversion between modes where possible:
 *   plain → rich wraps each line in <p>; rich → plain extracts plain text;
 *   plain ↔ markdown is zero-loss (raw text is valid Markdown).
 *
 * Download:
 * - Rich text exports as a minimal standalone HTML document with inline styles
 *   so it renders correctly when opened in any browser without this app's CSS.
 * - Markdown exports as `.md`; plain text as `.txt`.
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import generatePDF, { Resolution } from "react-to-pdf";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Upload,
  Search,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Undo2,
  Redo2,
  X,
  FileText,
  Table as TableIcon,
  Menu,
  Pencil,
  Eye,
  Columns2,
  Loader2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCopyFlag } from "@/lib/hooks/useCopyFlag";

// ─── Types ───────────────────────────────────────────────────────────────────

type NoteMode = "plain" | "rich" | "markdown";

interface Note {
  id: string;
  title: string;
  /** Plain text in plain mode; HTML string in rich mode; raw markdown in markdown mode */
  content: string;
  mode: NoteMode;
  updatedAt: number;
  mdView?: "write" | "preview";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "editorpad-notes";
const ACTIVE_KEY  = "editorpad-active";
const DEBOUNCE_MS = 500;

// Per-note cap (~1MB as UTF-16) and aggregate cap across all notes (~4MB).
// localStorage gives ~5MB per origin shared across every note, and persistNotes
// silently drops writes on QuotaExceededError — so we trim at the input boundary
// to keep storage from overflowing and losing data on the next reload.
export const MAX_NOTE_CHARS  = 500_000;
export const MAX_TOTAL_CHARS = 2_000_000;
const CHAR_WARN_THRESHOLD = Math.floor(MAX_NOTE_CHARS * 0.9);

const NOTE_LIMIT_MSG  = `Character limit reached — a note can hold up to ${MAX_NOTE_CHARS.toLocaleString()} characters. The extra text was trimmed.`;
const TOTAL_LIMIT_MSG = "Storage almost full — you've reached the total limit across all notes. Delete or shorten other notes to add more.";

const FONT_SIZE_OPTIONS = [
  { label: "S",  className: "text-sm"  },
  { label: "M",  className: "text-base" },
  { label: "L",  className: "text-lg"  },
  { label: "XL", className: "text-xl"  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timestampTitle(): string {
  const now = new Date();
  const dd  = String(now.getDate()).padStart(2, "0");
  const mm  = String(now.getMonth() + 1).padStart(2, "0");
  const yy  = String(now.getFullYear()).slice(-2);
  const hh  = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss  = String(now.getSeconds()).padStart(2, "0");
  return `${dd}-${mm}-${yy} ${hh}:${min}:${ss}`;
}

function createNote(): Note {
  return {
    id: crypto.randomUUID(),
    title: timestampTitle(),
    content: "",
    mode: "plain",
    updatedAt: Date.now(),
  };
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Note[];
  } catch {
    return [];
  }
}

function persistNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Quota exceeded or private browsing — silently skip
  }
}

/**
 * Trims an incoming value to the per-note and aggregate character caps.
 *
 * Data-safety invariant: this only ever caps *growth* — it never returns fewer
 * characters than the note already holds (`current`), and shrinking is always
 * allowed. So a note saved before these limits existed (or while other notes
 * already fill the aggregate budget) keeps all of its data; the worst case is
 * that it can't grow until the user trims it down. Content is never wiped.
 *
 * `othersTotal` is the combined content length of every other note, so the
 * aggregate cap accounts for what storage is already holding.
 */
export function clampToLimits(
  current: string,
  next: string,
  othersTotal: number,
): { value: string; notice: string | null } {
  // Shrinking or keeping the same length never increases storage — always allow.
  if (next.length <= current.length) return { value: next, notice: null };

  if (next.length > MAX_NOTE_CHARS) {
    const allowed = Math.max(current.length, MAX_NOTE_CHARS);
    return { value: next.slice(0, allowed), notice: NOTE_LIMIT_MSG };
  }
  if (othersTotal + next.length > MAX_TOTAL_CHARS) {
    const allowed = Math.max(current.length, MAX_TOTAL_CHARS - othersTotal);
    return { value: next.slice(0, allowed), notice: TOTAL_LIMIT_MSG };
  }
  return { value: next, notice: null };
}

// PDF export scales the off-screen container by `resolution` (html2canvas scale).
// Browsers cap a canvas at ~16384px per dimension cross-browser; past that the
// canvas comes back blank. Short notes render at full quality; longer notes get a
// lower scale to fit, and anything beyond the floor's reach is truncated + flagged.
const PDF_SCALE_MAX      = 7;     // matches react-to-pdf Resolution.HIGH
const PDF_SCALE_FLOOR    = 2;     // never blurrier than this (~192 DPI)
const PDF_MAX_CANVAS_DIM = 16384; // cross-browser safe max canvas dimension
const PDF_PAGE_CSS_HEIGHT = 1123; // ~A4 height at the 794px export width

/**
 * Picks a render scale and capture height that keep the export canvas within the
 * browser's size limit. `truncated` is true when the note is too tall to fit even
 * at the scale floor, so only the first `renderHeight` px are captured.
 */
export function computePdfRenderPlan(fullHeight: number): {
  scale: number;
  renderHeight: number;
  truncated: boolean;
  estimatedPages: number;
} {
  const maxSourceHeight = PDF_MAX_CANVAS_DIM / PDF_SCALE_FLOOR;
  const renderHeight = Math.min(fullHeight, maxSourceHeight);
  const truncated = fullHeight > maxSourceHeight;
  const scale = Math.max(
    PDF_SCALE_FLOOR,
    Math.min(PDF_SCALE_MAX, PDF_MAX_CANVAS_DIM / renderHeight),
  );
  const estimatedPages = Math.max(1, Math.ceil(renderHeight / PDF_PAGE_CSS_HEIGHT));
  return { scale, renderHeight, truncated, estimatedPages };
}

/**
 * Forces explicit light-theme colors onto an element subtree before PDF export.
 *
 * html2canvas does not reliably resolve CSS custom properties (`var(--foreground)`),
 * so in dark mode the markdown/rich text keeps its near-white color and renders
 * invisibly on the white PDF background. Setting concrete inline colors on every
 * node sidesteps var() resolution entirely and guarantees readable dark text.
 */
export function forceLightStyles(root: HTMLElement): void {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of elements) {
    const tag = el.tagName;
    el.style.color = tag === "BLOCKQUOTE" ? "#555555" : tag === "A" ? "#1a56db" : "#111111";
    el.style.borderColor = "#cccccc";
    if (tag === "CODE" || tag === "PRE" || tag === "TH") {
      el.style.backgroundColor = "#f4f4f4";
    }
  }
}

function computeStats(text: string) {
  const trimmed = text.trim();
  return {
    words: trimmed === "" ? 0 : trimmed.split(/\s+/).length,
    chars: text.length,
    lines: text === "" ? 0 : text.split("\n").length,
  };
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)        return "just now";
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Replaces plain-text occurrences inside HTML text nodes only (structure-safe).
 * Does not touch HTML tag names, attribute names, or attribute values.
 */
function safeReplaceInHTML(
  html: string,
  find: string,
  replace: string,
  replaceAll: boolean,
): string {
  if (!find) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  let foundOnce = false;

  function walk(node: Node): void {
    if (!replaceAll && foundOnce) return;
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      if (replaceAll) {
        node.textContent = node.textContent.split(find).join(replace);
        if (node.textContent !== node.textContent) foundOnce = true;
      } else {
        const idx = node.textContent.indexOf(find);
        if (idx !== -1) {
          node.textContent =
            node.textContent.slice(0, idx) +
            replace +
            node.textContent.slice(idx + find.length);
          foundOnce = true;
        }
      }
    } else {
      Array.from(node.childNodes).forEach(walk);
    }
  }

  walk(doc.body);
  return doc.body.innerHTML;
}

// ─── Rich-text toolbar ────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarBtn({ onClick, active, disabled, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 min-w-[1.75rem] items-center justify-center rounded px-1 text-xs transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground font-semibold",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

function RichToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const handleLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/50 p-1.5">
      {/* History */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Sep />

      {/* Headings */}
      {([1, 2, 3] as const).map((level) => (
        <ToolbarBtn
          key={level}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          active={editor.isActive("heading", { level })}
          title={`Heading ${level}`}
        >
          H{level}
        </ToolbarBtn>
      ))}

      <Sep />

      {/* Inline marks */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Underline"
      >
        <span className="underline text-xs font-medium">U</span>
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Inline code"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Sep />

      {/* Blocks */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code block"
      >
        <span className="font-mono text-[10px] leading-none">{`</>`}</span>
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Sep />

      {/* Link */}
      <ToolbarBtn onClick={handleLink} active={editor.isActive("link")} title="Insert / edit link">
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Sep />

      {/* Align */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Align left"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Align center"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Align right"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Sep />

      {/* Table */}
      <ToolbarBtn onClick={insertTable} title="Insert 3×3 table">
        <TableIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        disabled={!editor.can().addColumnAfter()}
        title="Add column"
      >
        +C
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().deleteColumn().run()}
        disabled={!editor.can().deleteColumn()}
        title="Delete column"
      >
        −C
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().addRowAfter().run()}
        disabled={!editor.can().addRowAfter()}
        title="Add row"
      >
        +R
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().deleteRow().run()}
        disabled={!editor.can().deleteRow()}
        title="Delete row"
      >
        −R
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().deleteTable().run()}
        disabled={!editor.can().deleteTable()}
        title="Delete table"
      >
        <span className="text-destructive text-[10px] leading-none font-semibold">✕T</span>
      </ToolbarBtn>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EditorPad() {
  const [mounted, setMounted]               = useState(false);
  const [notes, setNotes]                   = useState<Note[]>([]);
  const [activeId, setActiveId]             = useState<string | null>(null);
  const [renamingId, setRenamingId]         = useState<string | null>(null);
  const [renameValue, setRenameValue]       = useState("");
  const { isCopied: copied, trigger: triggerCopy } = useCopyFlag();
  const [wordWrap, setWordWrap]             = useState(true);
  const [fontSize, setFontSize]             = useState(1); // index into FONT_SIZE_OPTIONS
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText]             = useState("");
  const [replaceText, setReplaceText]       = useState("");
  const [richText, setRichText]             = useState(""); // live plain-text mirror for stats
  const [showSidebar, setShowSidebar]       = useState(false);
  const [mdView, setMdView]                 = useState<"write" | "preview">("write");
  const [mdSplit, setMdSplit]               = useState(false);
  const [notice, setNotice]                 = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef    = useRef<string | null>(null);
  activeIdRef.current  = activeId;
  const notesRef       = useRef<Note[]>([]);
  notesRef.current     = notes;

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(null);
  }, []);

  const othersContentTotal = useCallback(
    (excludeId: string | null) =>
      notesRef.current
        .filter((n) => n.id !== excludeId)
        .reduce((sum, n) => sum + n.content.length, 0),
    [],
  );

  // ─── Tiptap editor ──────────────────────────────────────────────────────────

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    editorProps: {
      attributes: { class: "editorpad-prosemirror focus:outline-none" },
    },
    onUpdate({ editor: e }) {
      const text = e.getText({ blockSeparator: "\n" });
      const html  = e.getHTML();
      const currentHtml = notesRef.current.find((n) => n.id === activeIdRef.current)?.content ?? "";
      const { notice: limitNotice } = clampToLimits(
        currentHtml,
        html,
        othersContentTotal(activeIdRef.current),
      );
      if (limitNotice) {
        // Can't cleanly slice contenteditable HTML, so revert the change that
        // pushed it over the cap. The follow-up onUpdate is back under the
        // limit, so this does not loop.
        showNotice(limitNotice);
        e.commands.undo();
        return;
      }
      setRichText(text);
      // Debounced persist
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const id = activeIdRef.current;
        if (!id) return;
        setNotes((prev) => {
          const updated = prev.map((n) =>
            n.id === id ? { ...n, content: html, updatedAt: Date.now() } : n,
          );
          persistNotes(updated);
          return updated;
        });
      }, DEBOUNCE_MS);
    },
  });

  // Cancel any pending timers when the component unmounts
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // ─── Mount & initial load ───────────────────────────────────────────────────

  useEffect(() => {
    setMounted(true);
    const stored     = loadNotes();
    const savedActive = localStorage.getItem(ACTIVE_KEY);
    if (stored.length === 0) {
      const first = createNote();
      setNotes([first]);
      setActiveId(first.id);
      localStorage.setItem(ACTIVE_KEY, first.id);
    } else {
      setNotes(stored);
      const valid = stored.find((n) => n.id === savedActive);
      const initialId = valid ? valid.id : stored[0].id;
      setActiveId(initialId);
      localStorage.setItem(ACTIVE_KEY, initialId);
    }
  }, []);

  // ─── Sync Tiptap content when active note changes ───────────────────────────

  useEffect(() => {
    if (!editor || !activeId) return;
    // Get note directly without adding notes to deps (avoids re-sync on every keystroke)
    setNotes((prev) => {
      const note = prev.find((n) => n.id === activeId);
      if (note?.mode === "rich") {
        const current = editor.getHTML();
        if (current !== note.content) {
          editor.commands.setContent(note.content || "");
          setRichText(editor.getText({ blockSeparator: "\n" }));
        }
      }
      if (note?.mode === "markdown") {
        setMdView(note.mdView ?? "write");
      }
      return prev; // no change to notes array
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, editor]);

  // ─── Keyboard shortcut: Ctrl+H / Cmd+H → toggle find/replace ───────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        setShowFindReplace((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId],
  );

  const statsText = activeNote?.mode === "rich" ? richText : (activeNote?.content ?? "");
  const stats     = computeStats(statsText);

  // ─── Auto-save for plain mode ───────────────────────────────────────────────

  // Shared by the plain-text and markdown textareas — both store raw text in
  // `content`, so trimming and persistence are identical.
  const handleContentChange = useCallback(
    (value: string) => {
      const activeIdNow = activeIdRef.current;
      const current = notesRef.current.find((n) => n.id === activeIdNow)?.content ?? "";
      const { value: clamped, notice: limitNotice } = clampToLimits(
        current,
        value,
        othersContentTotal(activeIdNow),
      );
      if (limitNotice) showNotice(limitNotice);

      setNotes((prev) => prev.map((n) => (n.id === activeId ? { ...n, content: clamped } : n)));
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const id = activeIdRef.current;
        if (!id) return;
        setNotes((prev) => {
          const updated = prev.map((n) =>
            n.id === id ? { ...n, content: clamped, updatedAt: Date.now() } : n,
          );
          persistNotes(updated);
          return updated;
        });
      }, DEBOUNCE_MS);
    },
    [activeId, othersContentTotal, showNotice],
  );

  const handleMdViewChange = (view: "write" | "preview") => {
    setMdView(view);
    if (!activeId) return;
    setNotes((prev) => {
      const updated = prev.map((n) => (n.id === activeId ? { ...n, mdView: view } : n));
      persistNotes(updated);
      return updated;
    });
  };

  // ─── Note management ────────────────────────────────────────────────────────

  const addNote = () => {
    const note = createNote();
    setNotes((prev) => {
      const next = [note, ...prev];
      persistNotes(next);
      return next;
    });
    setActiveId(note.id);
    localStorage.setItem(ACTIVE_KEY, note.id);
  };

  const selectNote = (id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      persistNotes(next);
      if (activeIdRef.current === id) {
        const newActive = next[0] ?? null;
        setActiveId(newActive?.id ?? null);
        if (newActive) localStorage.setItem(ACTIVE_KEY, newActive.id);
        else localStorage.removeItem(ACTIVE_KEY);
      }
      return next;
    });
  };

  const startRename = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(note.id);
    setRenameValue(note.title);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (!renamingId) return;
    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === renamingId
          ? { ...n, title: renameValue.trim() || "Untitled", updatedAt: Date.now() }
          : n,
      );
      persistNotes(updated);
      return updated;
    });
    setRenamingId(null);
  };

  // ─── Mode switching ─────────────────────────────────────────────────────────

  const switchToMode = (target: NoteMode) => {
    if (!activeNote || activeNote.mode === target) return;
    const from = activeNote.mode;
    let nextContent = activeNote.content;

    if (from === "plain" && target === "rich") {
      nextContent = activeNote.content
        .split("\n")
        .map((line) => (line.trim() === "" ? "<p></p>" : `<p>${line}</p>`))
        .join("");
      if (editor) { editor.commands.setContent(nextContent); setRichText(editor.getText({ blockSeparator: "\n" })); }
    } else if (from === "rich" && target === "plain") {
      nextContent = editor ? editor.getText({ blockSeparator: "\n" }) : activeNote.content;
    } else if (from === "plain" && target === "markdown") {
      // plain text is valid markdown — zero-loss, no transformation
      setMdView("write");
    } else if (from === "markdown" && target === "plain") {
      // raw markdown stays as plain text — keep content as-is
    } else if (from === "rich" && target === "markdown") {
      nextContent = editor ? editor.getText({ blockSeparator: "\n" }) : activeNote.content;
      setMdView("write");
    } else if (from === "markdown" && target === "rich") {
      nextContent = activeNote.content
        .split("\n")
        .map((line) => (line.trim() === "" ? "<p></p>" : `<p>${line}</p>`))
        .join("");
      if (editor) { editor.commands.setContent(nextContent); setRichText(editor.getText({ blockSeparator: "\n" })); }
    }

    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === activeId
          ? { ...n, mode: target, content: nextContent, updatedAt: Date.now() }
          : n,
      );
      persistNotes(updated);
      return updated;
    });
  };

  // ─── Utilities ───────────────────────────────────────────────────────────────

  const getPlainText = () => {
    if (!activeNote) return "";
    if (activeNote.mode === "rich") return editor?.getText({ blockSeparator: "\n" }) ?? "";
    return activeNote.content;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getPlainText());
      triggerCopy();
    } catch {
      // Clipboard write not available
    }
  };

  const handleDownload = () => {
    if (!activeNote) return;
    const safeName = activeNote.title.replace(/[^a-z0-9_\- ]/gi, "_");

    let content: string;
    let mimeType: string;
    let extension: string;

    if (activeNote.mode === "rich" && editor) {
      // Wrap Tiptap HTML in a minimal full HTML document so it renders correctly when opened
      const html = editor.getHTML();
      content = [
        "<!DOCTYPE html>",
        "<html lang=\"en\">",
        "<head>",
        "  <meta charset=\"UTF-8\" />",
        `  <title>${activeNote.title}</title>`,
        "  <style>",
        "    body { font-family: system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }",
        "    table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ccc; padding: 6px 12px; }",
        "    pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }",
        "    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }",
        "    blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 1rem; color: #555; }",
        "  </style>",
        "</head>",
        `<body>${html}</body>`,
        "</html>",
      ].join("\n");
      mimeType  = "text/html;charset=utf-8";
      extension = "html";
    } else if (activeNote.mode === "markdown") {
      content   = activeNote.content;
      mimeType  = "text/markdown;charset=utf-8";
      extension = "md";
    } else {
      content   = getPlainText();
      mimeType  = "text/plain;charset=utf-8";
      extension = "txt";
    }

    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${safeName}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!activeNote || isExportingPdf) return;
    const safeName = activeNote.title.replace(/[^a-z0-9_\- ]/gi, "_");
    setIsExportingPdf(true);

    // If markdown is in write-only view, switch to preview so the rendered
    // HTML exists in the DOM before we clone it, then restore after export.
    const needsMdViewRestore =
      activeNote.mode === "markdown" && mdView === "write" && !mdSplit;
    if (needsMdViewRestore) {
      handleMdViewChange("preview");
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    }

    // Build an off-screen container that has no height or overflow constraints.
    // Targeting the live editor elements directly causes html2canvas to capture
    // only the visible portion (h-full + overflow-y-auto clip the content).
    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;" +
      "width:794px;box-sizing:border-box;padding:32px;" +
      "background:#ffffff;color:#111111;" +
      "font-family:ui-sans-serif,system-ui,sans-serif;" +
      "font-size:14px;line-height:1.6;";

    if (activeNote.mode === "plain") {
      // html2canvas does not reliably capture <textarea> content; use <pre>.
      const pre = document.createElement("pre");
      pre.style.cssText =
        "white-space:pre-wrap;word-break:break-word;margin:0;" +
        "font-family:ui-monospace,monospace;font-size:13px;color:#111111;";
      pre.textContent = activeNote.content;
      container.appendChild(pre);
    } else {
      const srcId =
        activeNote.mode === "markdown" ? "pdf-target-md" : "pdf-target-rich";
      const src = document.getElementById(srcId);
      if (src) {
        const clone = src.cloneNode(true) as HTMLElement;
        clone.style.overflow = "visible";
        clone.style.height = "auto";
        clone.style.maxHeight = "none";
        container.appendChild(clone);
      }
    }

    // Bake in explicit dark colors so dark-mode text isn't white-on-white in the PDF.
    forceLightStyles(container);

    document.body.appendChild(container);

    // Keep the export canvas within the browser's size limit. Tall notes get a
    // lower scale; notes too tall even at the floor are clipped and flagged.
    const plan = computePdfRenderPlan(container.scrollHeight);
    if (plan.truncated) {
      container.style.height = `${plan.renderHeight}px`;
      container.style.overflow = "hidden";
    }

    try {
      await generatePDF(() => container, {
        filename: `${safeName}.pdf`,
        resolution: plan.scale as Resolution,
        canvas: { mimeType: "image/png" as const },
        overrides: {
          canvas: {
            height: plan.renderHeight,
            // Backup for any inherited background/border tokens: drop .dark so
            // theme variables fall back to light. Text color is handled directly
            // by forceLightStyles above, since html2canvas can't reliably resolve
            // var(--foreground).
            onclone: (clonedDoc: Document) => {
              clonedDoc.documentElement.classList.remove("dark");
            },
          },
        },
      });
      if (plan.truncated) {
        showNotice(
          `This note is too long for a single PDF — exported the first ~${plan.estimatedPages} pages. Shorten or split the note to include the rest.`,
        );
      }
    } finally {
      document.body.removeChild(container);
      if (needsMdViewRestore) {
        handleMdViewChange("write");
      }
      setIsExportingPdf(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isMarkdownFile = file.name.endsWith(".md");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result as string;
      // Floor at the existing content length so an over-budget upload trims the
      // incoming file rather than wiping the note.
      const { value: text, notice: limitNotice } = clampToLimits(
        activeNote?.content ?? "",
        raw,
        othersContentTotal(activeId),
      );
      if (limitNotice) showNotice(limitNotice);
      if (isMarkdownFile && activeNote?.mode !== "markdown") {
        // .md file uploaded into a non-markdown note — auto-switch to markdown mode
        setMdView("write");
        setNotes((prev) => {
          const updated = prev.map((n) =>
            n.id === activeId
              ? { ...n, mode: "markdown" as NoteMode, content: text, mdView: "write" as const, updatedAt: Date.now() }
              : n,
          );
          persistNotes(updated);
          return updated;
        });
        return;
      }
      if (activeNote?.mode === "plain" || activeNote?.mode === "markdown") {
        handleContentChange(text);
      } else if (editor) {
        const html = text
          .split("\n")
          .map((line) => (line.trim() === "" ? "<p></p>" : `<p>${line}</p>`))
          .join("");
        editor.commands.setContent(html);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ─── Find & Replace ─────────────────────────────────────────────────────────

  const applyReplace = (replaceAll: boolean) => {
    if (!activeNote || !findText) return;
    if (activeNote.mode === "plain" || activeNote.mode === "markdown") {
      const newContent = replaceAll
        ? activeNote.content.split(findText).join(replaceText)
        : activeNote.content.replace(findText, replaceText);
      handleContentChange(newContent);
    } else if (editor) {
      // Structure-safe: replaces only in text nodes, not inside HTML tags
      const newHTML = safeReplaceInHTML(editor.getHTML(), findText, replaceText, replaceAll);
      editor.commands.setContent(newHTML);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (!mounted) return null;

  const fontSizeClass = FONT_SIZE_OPTIONS[fontSize].className;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-360px)] min-h-[400px] md:min-h-[440px] overflow-hidden rounded-xl border bg-card shadow-sm">

      {/* ── Mobile header bar ─────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setShowSidebar((v) => !v)}
          className="rounded p-1 transition hover:bg-accent"
          title={showSidebar ? "Back to editor" : "Notes list"}
        >
          {showSidebar ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <span className="flex-1 truncate text-sm font-medium">
          {activeNote?.title ?? "—"}
        </span>
        <button
          type="button"
          onClick={addNote}
          className="rounded p-1 transition hover:bg-accent"
          title="New note"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={cn(
        "flex-shrink-0 flex-col border-b md:border-b-0 md:border-r md:w-52",
        showSidebar ? "flex" : "hidden",
        "md:flex",
      )}>
        <div className="hidden md:flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </span>
          <button
            type="button"
            onClick={addNote}
            className="rounded p-1 transition hover:bg-accent"
            title="New note"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto py-1">
          {notes.length === 0 && (
            <li className="px-3 py-4 text-center text-xs text-muted-foreground">
              No notes yet. Click + to create one.
            </li>
          )}
          {notes.map((note) => (
            <li key={note.id}>
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "group flex cursor-pointer items-start gap-2 px-3 py-2 transition-colors hover:bg-accent/50",
                  note.id === activeId && "bg-accent",
                )}
                onClick={() => { if (renamingId !== note.id) { selectNote(note.id); setShowSidebar(false); } }}
                onKeyDown={(e) => { if (e.key === "Enter") { selectNote(note.id); setShowSidebar(false); } }}
              >
                <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {renamingId === note.id ? (
                    <input
                      ref={renameInputRef}
                      className="w-full rounded border bg-background px-1 py-0 text-xs focus:outline-none"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")  commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p
                      className="truncate text-xs font-medium"
                      onDoubleClick={(e) => startRename(note, e)}
                      title="Double-click to rename"
                    >
                      {note.title}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{relativeTime(note.updatedAt)}</p>
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 rounded p-0.5 opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Editor pane ──────────────────────────────────────────────────────── */}
      <div className={cn("flex flex-1 flex-col overflow-hidden", showSidebar && "hidden md:flex")}>

        {/* ── Top toolbar ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
          {/* Mode toggle */}
          <div className="flex overflow-hidden rounded-md border text-xs">
            <button
              type="button"
              onClick={() => switchToMode("plain")}
              className={cn(
                "px-2.5 py-1 transition-colors",
                activeNote?.mode === "plain"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              Plain
            </button>
            <button
              type="button"
              onClick={() => switchToMode("markdown")}
              className={cn(
                "border-l px-2.5 py-1 transition-colors",
                activeNote?.mode === "markdown"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              MD
            </button>
            <button
              type="button"
              onClick={() => switchToMode("rich")}
              className={cn(
                "border-l px-2.5 py-1 transition-colors",
                activeNote?.mode === "rich"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              Rich
            </button>
          </div>

          {/* Font size */}
          <div className="flex overflow-hidden rounded-md border text-xs">
            {FONT_SIZE_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setFontSize(i)}
                className={cn(
                  "px-2 py-1 transition-colors",
                  i > 0 && "border-l",
                  fontSize === i
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Word wrap — plain and markdown write mode */}
          {(activeNote?.mode === "plain" || (activeNote?.mode === "markdown" && mdView === "write")) && (
            <button
              type="button"
              onClick={() => setWordWrap((v) => !v)}
              className={cn(
                "rounded border px-2.5 py-1 text-xs transition-colors",
                wordWrap
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
              title="Toggle word wrap"
            >
              Wrap
            </button>
          )}

          {/* Find & Replace toggle */}
          <button
            type="button"
            onClick={() => setShowFindReplace((v) => !v)}
            className={cn(
              "rounded border p-1.5 transition-colors",
              showFindReplace ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
            title="Find & Replace (Ctrl+H)"
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded border p-1.5 transition-colors hover:bg-accent"
              title="Upload file (.txt, .md)"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded border p-1.5 transition-colors hover:bg-accent"
              title={activeNote?.mode === "rich" ? "Download as .html" : activeNote?.mode === "markdown" ? "Download as .md" : "Download as .txt"}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              aria-busy={isExportingPdf}
              className={cn(
                "rounded border px-2 text-[10px] font-bold uppercase transition-colors hover:bg-accent h-[26px] flex items-center justify-center",
                isExportingPdf && "cursor-not-allowed opacity-60",
              )}
              title="Download as PDF"
            >
              {isExportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Generating PDF" />
              ) : (
                "PDF"
              )}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border p-1.5 transition-colors hover:bg-accent"
              title="Copy all text"
            >
              {copied
                ? <Check className="h-3.5 w-3.5 text-success" />
                : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* ── Rich-text formatting toolbar ─────────────────────────────────── */}
        {activeNote?.mode === "rich" && (
          <div className="border-b px-3 py-2">
            <RichToolbar editor={editor} />
          </div>
        )}

        {/* ── Markdown write/preview/split sub-toolbar ─────────────────────── */}
        {activeNote?.mode === "markdown" && (
          <div className="flex items-center gap-1.5 border-b px-3 py-1.5">
            <div className="flex overflow-hidden rounded-md border text-xs">
              <button
                type="button"
                onClick={() => handleMdViewChange("write")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 transition-colors",
                  mdView === "write"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                <Pencil className="h-3 w-3" />
                Write
              </button>
              <button
                type="button"
                onClick={() => handleMdViewChange("preview")}
                className={cn(
                  "border-l flex items-center gap-1 px-2.5 py-1 transition-colors",
                  mdView === "preview"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                <Eye className="h-3 w-3" />
                Preview
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMdSplit((v) => !v)}
              className={cn(
                "hidden md:flex items-center gap-1 rounded border px-2.5 py-1 text-xs transition-colors",
                mdSplit
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
              title="Split view — editor and preview side by side"
            >
              <Columns2 className="h-3 w-3" />
              Split
            </button>
          </div>
        )}

        {/* ── Find & Replace panel ─────────────────────────────────────────── */}
        {showFindReplace && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-3 py-2">
            <Input
              placeholder="Find…"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyReplace(false); }}
              className="h-7 w-full sm:w-36 text-xs"
            />
            <Input
              placeholder="Replace with…"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyReplace(false); }}
              className="h-7 w-full sm:w-36 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => applyReplace(false)}
              disabled={!findText}
            >
              Replace
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => applyReplace(true)}
              disabled={!findText}
            >
              Replace All
            </Button>
            <button
              type="button"
              className="ml-auto rounded p-1 hover:bg-accent"
              onClick={() => setShowFindReplace(false)}
              title="Close (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Limit notice ─────────────────────────────────────────────────── */}
        {notice && (
          <div
            role="alert"
            className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={dismissNotice}
              className="flex-shrink-0 rounded p-0.5 hover:bg-destructive/20"
              title="Dismiss notice"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Editor area ──────────────────────────────────────────────────── */}
        {activeNote === null ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Create a note to start writing.
          </div>
        ) : (
          <div className={cn("flex-1 overflow-hidden", fontSizeClass)}>
            {activeNote.mode === "plain" ? (
              <textarea
                id="pdf-target-plain"
                value={activeNote.content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Start typing…"
                className={cn(
                  "h-full w-full resize-none border-none bg-transparent p-4 font-mono focus:outline-none",
                  wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                )}
                spellCheck={false}
              />
            ) : activeNote.mode === "markdown" ? (
              <div className={cn("flex h-full overflow-hidden", mdSplit ? "md:flex-row" : "flex-col")}>
                {(mdView === "write" || mdSplit) && (
                  <textarea
                    value={activeNote.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Write markdown here…"
                    className={cn(
                      "resize-none border-none bg-transparent p-4 font-mono focus:outline-none",
                      mdSplit ? "h-full w-full md:w-1/2 md:border-r" : "h-full w-full",
                      wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                    )}
                    spellCheck={false}
                  />
                )}
                {(mdView === "preview" || mdSplit) && (
                  <div id="pdf-target-md" className={cn(
                    "editorpad-md-preview overflow-y-auto p-4",
                    mdSplit ? "h-full w-full md:w-1/2" : "h-full w-full",
                  )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeNote.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ) : (
              <div id="pdf-target-rich" className="editorpad-rich h-full overflow-y-auto p-4">
                <EditorContent editor={editor} />
              </div>
            )}
          </div>
        )}

        {/* ── Status bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 border-t bg-muted/50 px-3 py-1 text-[11px] text-muted-foreground">
          <span>{stats.words} words</span>
          <span className={cn(stats.chars >= CHAR_WARN_THRESHOLD && "font-medium text-destructive")}>
            {stats.chars} chars
          </span>
          <span>{stats.lines} lines</span>
          {activeNote && (
            <span className="ml-auto">
              {activeNote.mode === "plain" ? "Plain text" : activeNote.mode === "markdown" ? "Markdown" : "Rich text"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
