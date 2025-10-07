import Fuse from "fuse.js";
import type { ToolSummary } from "./tools.config";

const fuseOptions: Fuse.IFuseOptions<ToolSummary> = {
  includeScore: true,
  threshold: 0.35,
  keys: [
    { name: "title", weight: 0.6 },
    { name: "tags", weight: 0.4 },
  ],
};

let cachedFuse: Fuse<ToolSummary> | null = null;
let cachedData: ToolSummary[] | null = null;

export function searchTools(query: string, data: ToolSummary[]): ToolSummary[] {
  if (!query.trim()) {
    return data;
  }

  if (!cachedFuse || cachedData !== data) {
    cachedFuse = new Fuse(data, fuseOptions);
    cachedData = data;
  }

  const results = cachedFuse.search(query);
  return results.map((result) => result.item);
}
