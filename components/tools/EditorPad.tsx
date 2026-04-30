"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";

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
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type NoteMode = "plain" | "rich";

interface Note {
  id: string;
  title: string;
  /** Plain text in plain mode; HTML string in rich mode */
  content: string;
  mode: NoteMode;
  updatedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "editorpad-notes";
const ACTIVE_KEY  = "editorpad-active";
const DEBOUNCE_MS = 500;

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
  const [copied, setCopied]                 = useState(false);
  const [wordWrap, setWordWrap]             = useState(true);
  const [fontSize, setFontSize]             = useState(1); // index into FONT_SIZE_OPTIONS
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText]             = useState("");
  const [replaceText, setReplaceText]       = useState("");
  const [richText, setRichText]             = useState(""); // live plain-text mirror for stats

  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const activeIdRef    = useRef<string | null>(null);
  activeIdRef.current  = activeId;

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
      const text = e.getText();
      const html  = e.getHTML();
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
          setRichText(editor.getText());
        }
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

  const handlePlainChange = useCallback(
    (value: string) => {
      setNotes((prev) => prev.map((n) => (n.id === activeId ? { ...n, content: value } : n)));
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const id = activeIdRef.current;
        if (!id) return;
        setNotes((prev) => {
          const updated = prev.map((n) =>
            n.id === id ? { ...n, content: value, updatedAt: Date.now() } : n,
          );
          persistNotes(updated);
          return updated;
        });
      }, DEBOUNCE_MS);
    },
    [activeId],
  );

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

  const toggleMode = () => {
    if (!activeNote) return;
    const nextMode: NoteMode = activeNote.mode === "plain" ? "rich" : "plain";
    let nextContent = activeNote.content;

    if (nextMode === "rich") {
      // Convert plain text → minimal HTML paragraphs for Tiptap
      nextContent = activeNote.content
        .split("\n")
        .map((line) => `<p>${line.trim() === "" ? "<br/>" : line}</p>`)
        .join("");
      if (editor) {
        editor.commands.setContent(nextContent);
        setRichText(editor.getText());
      }
    } else {
      // Convert rich HTML → plain text (fall back to existing content if editor is unavailable)
      nextContent = editor ? editor.getText() : activeNote.content;
    }

    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === activeId
          ? { ...n, mode: nextMode, content: nextContent, updatedAt: Date.now() }
          : n,
      );
      persistNotes(updated);
      return updated;
    });
  };

  // ─── Utilities ───────────────────────────────────────────────────────────────

  const getPlainText = () => {
    if (!activeNote) return "";
    if (activeNote.mode === "rich") return editor?.getText() ?? "";
    return activeNote.content;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getPlainText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (activeNote?.mode === "plain") {
        handlePlainChange(text);
      } else if (editor) {
        const html = text
          .split("\n")
          .map((line) => `<p>${line.trim() === "" ? "<br/>" : line}</p>`)
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
    if (activeNote.mode === "plain") {
      const newContent = replaceAll
        ? activeNote.content.split(findText).join(replaceText)
        : activeNote.content.replace(findText, replaceText);
      handlePlainChange(newContent);
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
    <div className="flex h-[calc(100vh-360px)] min-h-[440px] overflow-hidden rounded-xl border bg-card shadow-sm">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="flex w-52 flex-shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
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
                onClick={() => { if (renamingId !== note.id) selectNote(note.id); }}
                onKeyDown={(e) => { if (e.key === "Enter") selectNote(note.id); }}
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
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* ── Top toolbar ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
          {/* Mode toggle */}
          <div className="flex overflow-hidden rounded-md border text-xs">
            <button
              type="button"
              onClick={() => activeNote?.mode !== "plain" && toggleMode()}
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
              onClick={() => activeNote?.mode !== "rich" && toggleMode()}
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

          {/* Word wrap — plain mode only */}
          {activeNote?.mode === "plain" && (
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
              title={activeNote?.mode === "rich" ? "Download as .html" : "Download as .txt"}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border p-1.5 transition-colors hover:bg-accent"
              title="Copy all text"
            >
              {copied
                ? <Check className="h-3.5 w-3.5 text-emerald-500" />
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

        {/* ── Find & Replace panel ─────────────────────────────────────────── */}
        {showFindReplace && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-3 py-2">
            <Input
              placeholder="Find…"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyReplace(false); }}
              className="h-7 w-36 text-xs"
            />
            <Input
              placeholder="Replace with…"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyReplace(false); }}
              className="h-7 w-36 text-xs"
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

        {/* ── Editor area ──────────────────────────────────────────────────── */}
        {activeNote === null ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Create a note to start writing.
          </div>
        ) : (
          <div className={cn("flex-1 overflow-auto", fontSizeClass)}>
            {activeNote.mode === "plain" ? (
              <textarea
                value={activeNote.content}
                onChange={(e) => handlePlainChange(e.target.value)}
                placeholder="Start typing…"
                className={cn(
                  "h-full w-full resize-none border-none bg-transparent p-4 font-mono focus:outline-none",
                  wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                )}
                spellCheck={false}
              />
            ) : (
              <div className="editorpad-rich h-full p-4">
                <EditorContent editor={editor} />
              </div>
            )}
          </div>
        )}

        {/* ── Status bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 border-t bg-muted/50 px-3 py-1 text-[11px] text-muted-foreground">
          <span>{stats.words} words</span>
          <span>{stats.chars} chars</span>
          <span>{stats.lines} lines</span>
          {activeNote && (
            <span className="ml-auto">
              {activeNote.mode === "plain" ? "Plain text" : "Rich text"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
