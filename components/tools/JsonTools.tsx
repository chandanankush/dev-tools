/**
 * JSON Tools — multi-mode editor for working with JSON in the browser.
 *
 * Two views share a single `jsonContent` string as the source of truth:
 *   - "text"   : raw textarea editor with format / minify / download actions
 *   - "viewer" : read-only tree rendered by JsonViewer (requires valid JSON)
 *
 * Design decisions:
 *   - Format and minify both round-trip through JSON.parse → JSON.stringify so
 *     they also act as validators: if the input is invalid the parse throws and
 *     the error banner is shown instead of silently producing bad output.
 *   - Download always formats (pretty-prints) the file regardless of the
 *     current text state, so the saved file is always human-readable.
 *   - `getParsedData` is a silent helper used only by the viewer tab; it
 *     returns null on invalid JSON rather than throwing, because the viewer
 *     handles the error prop separately via the same `error` state.
 *   - Error is cleared on every keystroke so stale messages don't linger after
 *     the user edits the content.
 */

"use client";

import { useState, useCallback } from "react";
import {
  Download,
  Eraser,
  FileJson,
  FileText,
  Indent,
  Minimize2,
} from "lucide-react";

import JsonViewer from "@/components/tools/JsonViewer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** The two view modes. "text" is the raw editor; "viewer" is the tree explorer. */
type Tab = "text" | "viewer";

/** JSON editor with format, minify, validate, download, and tree-view capabilities. */
export default function JsonTools() {
  const [activeTab, setActiveTab] = useState<Tab>("text");
  const [jsonContent, setJsonContent] = useState("");
  // null means no error; a string is the human-readable parse or action error
  const [error, setError] = useState<string | null>(null);

  /** Re-serialises with 2-space indent; also validates syntax as a side effect. */
  const handleFormat = useCallback(() => {
    try {
      if (!jsonContent.trim()) return;
      const parsed = JSON.parse(jsonContent);
      setJsonContent(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [jsonContent]);

  /** Strips all whitespace by serialising without indent arguments. */
  const handleMinify = useCallback(() => {
    try {
      if (!jsonContent.trim()) return;
      const parsed = JSON.parse(jsonContent);
      setJsonContent(JSON.stringify(parsed));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [jsonContent]);

  const handleClear = useCallback(() => {
    setJsonContent("");
    setError(null);
  }, []);

  /**
   * Downloads a pretty-printed version of the current JSON.
   * Always re-formats before saving so the file is readable regardless of
   * whether the user last minified or hand-edited.
   */
  const handleDownload = useCallback(() => {
    try {
      if (!jsonContent.trim()) {
        setError("Please enter JSON to download.");
        return;
      }

      const parsed = JSON.parse(jsonContent);
      const formatted = JSON.stringify(parsed, null, 2);

      const blob = new Blob([formatted], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "data.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoke immediately after the click event has fired to free memory
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
    }
  }, [jsonContent]);

  /**
   * Parses the current text and returns the JS value, or null if empty/invalid.
   * Used exclusively to feed the viewer tab — errors are surfaced via `error` state.
   */
  const getParsedData = useCallback(() => {
    try {
      return jsonContent.trim() ? JSON.parse(jsonContent) : null;
    } catch {
      return null;
    }
  }, [jsonContent]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-2 shadow-sm">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("text")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === "text"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FileText className="h-4 w-4" />
            Text
          </button>
          <button
            onClick={() => setActiveTab("viewer")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === "viewer"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FileJson className="h-4 w-4" />
            Viewer
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            title="Format JSON"
          >
            <Indent className="h-4 w-4" />
            <span className="hidden sm:inline">Format</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMinify}
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            title="Remove Whitespace"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Remove white space</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            title="Clear"
          >
            <Eraser className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            title="Download JSON"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download JSON</span>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="h-[calc(100vh-380px)] min-h-[440px] rounded-xl border bg-card shadow-sm">
        {activeTab === "text" ? (
          <div className="relative h-full">
            <Textarea
              value={jsonContent}
              onChange={(e) => {
                setJsonContent(e.target.value);
                // Clear stale error on every keystroke so messages don't linger
                setError(null);
              }}
              placeholder="Paste your JSON here..."
              className="h-full w-full resize-none rounded-xl border-0 bg-transparent p-6 font-mono text-sm focus-visible:ring-0"
              spellCheck={false}
            />
            {error && (
              <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive backdrop-blur-sm">
                Error: {error}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full p-4">
            {/*
              Pass the error from a previous action OR derive "Invalid JSON" when
              the text is non-empty but doesn't parse — covers the case where the
              user switches to the viewer without having pressed Format first.
            */}
            <JsonViewer
              data={getParsedData()}
              error={
                error ||
                (jsonContent.trim() && !getParsedData() ? "Invalid JSON" : null)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
