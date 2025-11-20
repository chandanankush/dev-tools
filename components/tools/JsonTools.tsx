"use client";

import { useState, useCallback } from "react";
import {
  Eraser,
  FileJson,
  FileText,
  Indent,
  Minimize2,
  RefreshCw,
} from "lucide-react";

import JsonViewer from "@/components/tools/JsonViewer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tab = "text" | "viewer";

const sampleJson = {
  name: "Dev Toolkit",
  version: "1.0.0",
  features: ["Prettifier", "Viewer", "Minifier"],
  active: true,
};

export default function JsonTools() {
  const [activeTab, setActiveTab] = useState<Tab>("text");
  const [jsonContent, setJsonContent] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const handleLoadSample = useCallback(() => {
    setJsonContent(JSON.stringify(sampleJson, null, 2));
    setError(null);
  }, []);

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
            onClick={handleLoadSample}
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
            title="Load Sample Data"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Load Data</span>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[600px] rounded-xl border bg-card shadow-sm">
        {activeTab === "text" ? (
          <div className="relative h-full min-h-[600px]">
            <Textarea
              value={jsonContent}
              onChange={(e) => {
                setJsonContent(e.target.value);
                setError(null);
              }}
              placeholder="Paste your JSON here..."
              className="h-full min-h-[600px] w-full resize-none rounded-xl border-0 bg-transparent p-6 font-mono text-sm focus-visible:ring-0"
              spellCheck={false}
            />
            {error && (
              <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive backdrop-blur-sm">
                Error: {error}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full min-h-[600px] p-4">
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
