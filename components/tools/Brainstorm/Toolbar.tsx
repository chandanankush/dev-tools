/**
 * Toolbar — presentational only. Every control forwards straight to a
 * useBrainstorm setter/action; there is no geometry or scene logic here.
 */
"use client";

import {
  MousePointer2,
  Hand,
  Pencil,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Upload,
  Trash2,
  Copy,
  Trash,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ToolName } from "./useBrainstorm";

const TOOLS: { name: ToolName; label: string; Icon: typeof MousePointer2 }[] = [
  { name: "select", label: "Select", Icon: MousePointer2 },
  { name: "hand", label: "Hand", Icon: Hand },
  { name: "pen", label: "Pen", Icon: Pencil },
  { name: "rectangle", label: "Rectangle", Icon: Square },
  { name: "ellipse", label: "Ellipse", Icon: Circle },
  { name: "line", label: "Line", Icon: Minus },
  { name: "arrow", label: "Arrow", Icon: ArrowRight },
  { name: "text", label: "Text", Icon: Type },
  { name: "eraser", label: "Eraser", Icon: Eraser },
];

export interface ToolbarProps {
  tool: ToolName;
  setTool: (tool: ToolName) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  fillColor: string | null;
  setFillColor: (color: string | null) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  hasSelection: boolean;
  onExportPng: () => void;
  onExportJson: () => void;
  onImportJson: (text: string) => void;
  onClear: () => void;
  elementCount: number;
}

export function Toolbar({
  tool,
  setTool,
  strokeColor,
  setStrokeColor,
  fillColor,
  setFillColor,
  strokeWidth,
  setStrokeWidth,
  zoom,
  onZoomIn,
  onZoomOut,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  hasSelection,
  onExportPng,
  onExportJson,
  onImportJson,
  onClear,
  elementCount,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onImportJson(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleClearClick() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    onClear();
    setConfirmingClear(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2" data-element-count={elementCount}>
      <div className="flex items-center gap-1" role="group" aria-label="Tools">
        {TOOLS.map(({ name, label, Icon }) => (
          <Button
            key={name}
            type="button"
            variant={tool === name ? "default" : "ghost"}
            size="icon"
            aria-pressed={tool === name}
            aria-label={label}
            title={label}
            onClick={() => setTool(name)}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Stroke
        <input
          type="color"
          aria-label="Stroke color"
          value={strokeColor}
          onChange={(e) => setStrokeColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-input bg-background p-0.5"
        />
      </label>

      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Fill
        <input
          type="color"
          aria-label="Fill color"
          value={fillColor ?? "#ffffff"}
          onChange={(e) => setFillColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-input bg-background p-0.5"
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => setFillColor(null)} disabled={fillColor === null}>
          None
        </Button>
      </label>

      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Width
        <input
          type="number"
          aria-label="Stroke width"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value) || 1)}
          className="h-7 w-14 rounded border border-input bg-background px-1 text-sm"
        />
      </label>

      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" aria-label="Zoom out" onClick={onZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button type="button" variant="ghost" size="icon" aria-label="Zoom in" onClick={onZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

      <Button type="button" variant="ghost" size="icon" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Redo" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Duplicate selection" disabled={!hasSelection} onClick={onDuplicate}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Delete selection" disabled={!hasSelection} onClick={onDelete}>
        <Trash className="h-4 w-4" />
      </Button>

      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

      <Button type="button" variant="outline" size="sm" onClick={onExportPng}>
        <Download className="mr-1.5 h-4 w-4" />
        Export PNG
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onExportJson}>
        <Download className="mr-1.5 h-4 w-4" />
        Export JSON
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
        <Upload className="mr-1.5 h-4 w-4" />
        Import JSON
      </Button>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFileChange} aria-hidden="true" />

      <Button
        type="button"
        variant={confirmingClear ? "default" : "outline"}
        size="sm"
        onClick={handleClearClick}
        onBlur={() => setConfirmingClear(false)}
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        {confirmingClear ? "Click again to confirm" : "Clear"}
      </Button>
    </div>
  );
}
