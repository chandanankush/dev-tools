/**
 * Site-wide visitor counter — the one piece of server-side persistence in the app.
 *
 * Stores a single integer in `<VISITS_DATA_DIR>/visits.json` (default `./data`; the
 * Docker image uses `/app/data`, which must be a mounted volume or the count resets
 * on every deploy). Nothing about individual visitors is stored — no IP, no user
 * agent, no per-visit timestamp.
 *
 * Single-process by design: the count is cached in memory and increments are
 * serialised through `queue`, so concurrent requests cannot lose updates. Running
 * more than one instance against the same file would need a real database.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const dataDir = () => process.env.VISITS_DATA_DIR || path.join(process.cwd(), "data");
const dataFile = () => path.join(dataDir(), "visits.json");

let cache: number | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<number> {
  if (cache !== null) return cache;

  const file = dataFile();
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
    const count = (parsed as { count?: unknown } | null)?.count;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new SyntaxError("invalid count");
    }
    cache = count;
  } catch (error) {
    // Missing file is the normal first run. Anything else is a damaged file:
    // keep it aside for recovery instead of silently overwriting it.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      await fs.rename(file, `${file}.corrupt`).catch(() => undefined);
    }
    cache = 0;
  }
  return cache;
}

async function persist(count: number): Promise<void> {
  const file = dataFile();
  const tmp = `${file}.tmp`;
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify({ count, updatedAt: new Date().toISOString() }));
  // rename is atomic on the same filesystem, so a crash never leaves a half-written file
  await fs.rename(tmp, file);
}

export function getCount(): Promise<number> {
  return load();
}

export function incrementCount(): Promise<number> {
  const run = queue.then(async () => {
    const next = (await load()) + 1;
    await persist(next);
    cache = next;
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}
