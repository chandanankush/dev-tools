/**
 * Client-side fuzzy search for the tool gallery.
 *
 * Uses Fuse.js (https://fusejs.io/) rather than a simple substring match so
 * that partial, out-of-order, and slightly misspelled queries still surface
 * relevant results (e.g. "jsn" matches "JSON Tools").
 *
 * The Fuse index is built once and cached at module scope. Because the tool
 * list is static (loaded from tools.config.ts and never mutated at runtime)
 * the cache is valid for the lifetime of the page. Building the index on
 * every keystroke would add ~5–10 ms per search call — negligible for a small
 * dataset, but the cache also guards against callers accidentally passing a
 * new array reference on every render without changing the underlying data.
 */

import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { ToolSearchable } from "./tools.config";

// Title is weighted more heavily than tags so that an exact title match
// always outranks a tag-only match in the result ordering.
const fuseOptions: IFuseOptions<ToolSearchable> = {
  includeScore: true,
  // 0 = exact match required, 1 = match anything. 0.35 allows one or two
  // character transpositions while still filtering clearly irrelevant results.
  threshold: 0.35,
  keys: [
    { name: "title", weight: 0.6 },
    { name: "tags", weight: 0.4 },
  ],
};

// Module-level cache: the Fuse instance and the data array it was built from.
// Both are kept in sync — if the caller passes a different array reference the
// index is rebuilt automatically (see the identity check in searchTools).
let cachedFuse: Fuse<ToolSearchable> | null = null;
let cachedData: ToolSearchable[] | null = null;

/**
 * Filters `data` to items that match `query` using Fuse.js fuzzy search.
 *
 * The generic constraint `T extends ToolSearchable` lets callers pass either
 * `ToolMeta[]` or `ToolSummary[]` and receive back the same concrete type —
 * no information is lost and no casting is required at the call site.
 *
 * @param query - The search string; returns the full `data` array unchanged
 *   when blank so the gallery shows all tools with an empty input.
 * @param data  - The array to search; must satisfy the ToolSearchable shape.
 * @returns Matching items in Fuse score order (best match first).
 */
export function searchTools<T extends ToolSearchable>(query: string, data: T[]): T[] {
  if (!query.trim()) {
    return data;
  }

  // Rebuild the index only when the data reference changes, not on every call.
  if (!cachedFuse || cachedData !== (data as ToolSearchable[])) {
    cachedFuse = new Fuse(data as ToolSearchable[], fuseOptions);
    cachedData = data as ToolSearchable[];
  }

  const results = cachedFuse.search(query);
  // Fuse wraps each result in { item, score, ... }; unwrap and restore the
  // original concrete type T via the cast (safe because we only inserted T[]).
  return results.map((result) => result.item as T);
}
