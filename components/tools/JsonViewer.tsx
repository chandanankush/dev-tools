"use client";

import { useState } from "react";
import { FileJson, MinusSquare, PlusSquare } from "lucide-react";

type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

type JsonViewerProps = {
  data: JsonValue | null;
  error?: string | null;
};

type TreeNodeProps = {
  value: JsonValue;
  path: string;
  depth: number;
  label?: string; // Optional for root
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  isLast: boolean;
};

function JsonTreeNode({
  value,
  path,
  depth,
  label,
  expanded,
  onToggle,
  isLast,
}: TreeNodeProps) {
  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);
  const isExpandable = isObject && (isArray ? value.length > 0 : Object.keys(value).length > 0);
  const isOpen = expanded[path] ?? depth === 0; // Root open by default

  // Colors matching reference
  // Keys: #795da3 (Purple)
  // Strings: #183691 (Greenish Blue - Reference looked green, but standard is often green. Let's stick to standard "jsonviewer" green for strings if reference was ambiguous, but user said "exact match". Screenshot analysis said "Green". Let's use a standard green #008000 or similar if #183691 is blue. Wait, #183691 is dark blue. Let's use a nice Green for strings: #2a9d8f or standard #008000. Actually, let's use the reference hex if I can derive it. Screenshot said "String values are green". I will use #df5000 for numbers/bools maybe? Let's try to approximate the "standard" look.)
  // Let's use:
  // Key: #795da3 (Purple)
  // String: #df5000 (Red/Orange? No, user said Green). Let's use #008000 (Green).
  // Number: #0000ff (Blue)
  // Boolean: #0000ff (Blue)
  // Null: #808080 (Gray)

  const renderValue = () => {
    if (value === null) return <span className="font-bold text-gray-500">null</span>;
    if (typeof value === "string") return <span className="text-[#008000]">&quot;{value}&quot;</span>;
    if (typeof value === "number") return <span className="text-[#0000ff]">{value}</span>;
    if (typeof value === "boolean") return <span className="text-[#0000ff]">{String(value)}</span>;
    return null;
  };

  const renderPreview = () => {
    if (isArray) return <span className="text-gray-500">Array[{value.length}]</span>;
    if (isObject) return <span className="text-gray-500">Object{`{${Object.keys(value).length}}`}</span>;
    return null;
  };

  return (
    <div className="font-mono text-[13px] leading-5">
      <div className="group flex items-start hover:bg-gray-100 dark:hover:bg-gray-800">
        {/* Indentation */}
        <div style={{ width: depth * 20 }} className="flex-shrink-0" />

        {/* Icon / Spacer */}
        <div className="mr-1 mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center">
          {isExpandable ? (
            <button
              onClick={() => onToggle(path)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              {isOpen ? (
                <MinusSquare className="h-3 w-3" />
              ) : (
                <PlusSquare className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="h-3 w-3" />
          )}
        </div>

        {/* Content */}
        <div className="flex flex-wrap items-center break-all">
          {label && (
            <span className="mr-1 text-[#795da3]">
              {label}:
            </span>
          )}

          {!isExpandable ? (
            <>
              {renderValue()}
              {!isLast && <span className="text-gray-500">,</span>}
            </>
          ) : (
            <>
              {isOpen ? (
                <span>{isArray ? "[" : "{"}</span>
              ) : (
                <>
                  {renderPreview()}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpandable && isOpen && (
        <div>
          {isArray
            ? value.map((item, index) => (
              <JsonTreeNode
                key={`${path}/${index}`}
                value={item}
                path={`${path}/${index}`}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                isLast={index === value.length - 1}
              />
            ))
            : Object.entries(value).map(([key, val], index, arr) => (
              <JsonTreeNode
                key={`${path}/${key}`}
                value={val}
                path={`${path}/${key}`}
                depth={depth + 1}
                label={key}
                expanded={expanded}
                onToggle={onToggle}
                isLast={index === arr.length - 1}
              />
            ))}
          {/* Closing Brace/Bracket */}
          <div className="group flex items-start hover:bg-gray-100 dark:hover:bg-gray-800">
            <div style={{ width: depth * 20 }} className="flex-shrink-0" />
            <div className="mr-1 flex h-4 w-4 flex-shrink-0" /> {/* Spacer for icon alignment */}
            <div className="text-gray-800 dark:text-gray-300">
              {isArray ? "]" : "}"}
              {!isLast && <span className="text-gray-500">,</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JsonViewer({ data, error }: JsonViewerProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });

  const handleToggle = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-destructive">
        <FileJson className="h-8 w-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
        <FileJson className="h-8 w-8" />
        <p className="text-sm">No JSON data to display.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto rounded-xl border bg-white p-4 text-sm shadow-sm dark:bg-gray-950">
      <JsonTreeNode
        value={data}
        path="root"
        depth={0}
        expanded={expanded}
        onToggle={handleToggle}
        isLast={true}
      />
    </div>
  );
}
