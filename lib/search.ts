import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { ToolSearchable } from "./tools.config";

const fuseOptions: IFuseOptions<ToolSearchable> = {
  includeScore: true,
  threshold: 0.35,
  keys: [
    { name: "title", weight: 0.6 },
    { name: "tags", weight: 0.4 },
  ],
};

let cachedFuse: Fuse<ToolSearchable> | null = null;
let cachedData: ToolSearchable[] | null = null;

export function searchTools<T extends ToolSearchable>(query: string, data: T[]): T[] {
  if (!query.trim()) {
    return data;
  }

  if (!cachedFuse || cachedData !== (data as ToolSearchable[])) {
    cachedFuse = new Fuse(data as ToolSearchable[], fuseOptions);
    cachedData = data as ToolSearchable[];
  }

  const results = cachedFuse.search(query);
  return results.map((result) => result.item as T);
}
