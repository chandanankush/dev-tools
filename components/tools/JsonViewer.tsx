/**
 * JsonViewer — interactive collapsible tree for exploring parsed JSON.
 *
 * Rendering strategy:
 *   - `JsonTreeNode` is a recursive component; each call renders exactly one
 *     node (key + value) and then calls itself for every child.
 *   - Expand/collapse state is stored as a flat `Record<path, boolean>` in the
 *     parent `JsonViewer`, keyed by a slash-separated path string
 *     (e.g. "root/users/0/name"). This avoids threading boolean state down
 *     through every level and lets any ancestor or sibling toggle any node.
 *   - The root node defaults to open (`depth === 0`); all other nodes default
 *     to closed (key absent from the record → treated as false).
 *
 * Type-based color scheme (approximates standard JSON viewer conventions):
 *   - Object keys : #795da3 (purple)
 *   - Strings     : #008000 (green)
 *   - Numbers     : #0000ff (blue)
 *   - Booleans    : #0000ff (blue)
 *   - null        : gray, bold
 *
 * Tailwind indentation:
 *   Tailwind's content scanner requires full class strings to be present in
 *   source — it cannot assemble them from concatenated variables. The
 *   `JSON_INDENT` array pre-declares every class that might be used so they
 *   are included in the purged CSS bundle.
 */

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

// Tailwind pl-* classes for each depth level (depth * 20px). Full strings required so
// Tailwind's content scanner keeps them. Capped at index 10 (200px) for extreme nesting.
const JSON_INDENT = [
  '',           // 0:  0px
  'pl-5',       // 1:  20px
  'pl-10',      // 2:  40px
  'pl-[60px]',  // 3:  60px
  'pl-20',      // 4:  80px
  'pl-[100px]', // 5:  100px
  'pl-[120px]', // 6:  120px
  'pl-[140px]', // 7:  140px
  'pl-[160px]', // 8:  160px
  'pl-[180px]', // 9:  180px
  'pl-[200px]', // 10: 200px
] as const;

/**
 * Renders a single JSON node and, when expanded, recurses into its children.
 * `path` is a slash-separated string used as the key into the shared `expanded` map.
 * `isLast` controls whether a trailing comma is rendered after the value.
 */
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
  // Only objects/arrays with at least one child are toggle-able
  const isExpandable = isObject && (isArray ? value.length > 0 : Object.keys(value).length > 0);
  // Root node (depth 0) is open by default; all others start collapsed
  const isOpen = expanded[path] ?? depth === 0;

  // Colors matching reference
  // Keys: #795da3 (Purple)
  // Strings: #183691 (Greenish Blue - Reference looked green, but standard is often green. Let's stick to standard "jsonviewer" green for strings if reference was ambiguous, but user said "exact match". Screenshot analysis said "Green". Let's use a standard green #008000 or similar if #183691 is blue. Wait, #183691 is dark blue. Let's use a nice Green for strings: #2a9d8f or standard #008000. Actually, let's use the reference hex if I can derive it. Screenshot said "String values are green". I will use #df5000 for numbers/bools maybe? Let's try to approximate the "standard" look.)
  // Let's use:
  // Key: #795da3 (Purple)
  // String: #df5000 (Red/Orange? No, user said Green). Let's use #008000 (Green).
  // Number: #0000ff (Blue)
  // Boolean: #0000ff (Blue)
  // Null: #808080 (Gray)

  /** Returns a colored span for scalar (leaf) values; returns null for objects/arrays. */
  const renderValue = () => {
    if (value === null) return <span className="font-bold text-gray-500">null</span>;
    if (typeof value === "string") return <span className="text-[#008000]">&quot;{value}&quot;</span>;
    if (typeof value === "number") return <span className="text-[#0000ff]">{value}</span>;
    if (typeof value === "boolean") return <span className="text-[#0000ff]">{String(value)}</span>;
    return null;
  };

  /** Returns a collapsed summary badge (e.g. "Array[3]") shown when the node is closed. */
  const renderPreview = () => {
    if (isArray) return <span className="text-gray-500">Array[{value.length}]</span>;
    if (isObject) return <span className="text-gray-500">Object{`{${Object.keys(value).length}}`}</span>;
    return null;
  };

  // Clamp depth to the last pre-declared class; beyond 10 levels use the max indent
  const indentClass = JSON_INDENT[Math.min(depth, 10)] ?? 'pl-[200px]';

  return (
    <div className="font-mono text-[13px] leading-5">
      <div className={`group flex items-start hover:bg-gray-100 dark:hover:bg-gray-800${indentClass ? ` ${indentClass}` : ''}`}>

        {/* Toggle icon for expandable nodes; empty spacer otherwise to preserve alignment */}
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
          {/* Key label is omitted at the root level and for array elements */}
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
                // Opening bracket is shown inline with the key when expanded
                <span>{isArray ? "[" : "{"}</span>
              ) : (
                <>
                  {/* Collapsed: show summary count badge instead of bracket */}
                  {renderPreview()}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recursively render children only when this node is expanded */}
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
                // Trailing comma omitted on the last element (matches JSON syntax)
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
          {/* Closing bracket rendered at the same indent level as the opening line */}
          <div className={`group flex items-start hover:bg-gray-100 dark:hover:bg-gray-800${indentClass ? ` ${indentClass}` : ''}`}>
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

/**
 * Collapsible JSON tree viewer; shows an error state or empty state when
 * data is unavailable. Expand/collapse state is owned here so it persists
 * while the user edits in the sibling text tab.
 */
export default function JsonViewer({ data, error }: JsonViewerProps) {
  // Flat map of path → isOpen; "root" pre-seeded as true so the top level is visible
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
