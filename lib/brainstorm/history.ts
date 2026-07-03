/**
 * Bounded undo/redo over Scene snapshots. Pushing a new snapshot always
 * clears `future` — once the user does something new after an undo, the
 * redone-away states are gone, matching every standard editor's undo model.
 */
import type { Scene } from "./types";

export type History = { past: Scene[]; present: Scene; future: Scene[] };

const MAX_HISTORY = 100;

export function createHistory(initial: Scene): History {
  return { past: [], present: initial, future: [] };
}

export function pushSnapshot(history: History, next: Scene): History {
  const past = [...history.past, history.present].slice(-MAX_HISTORY);
  return { past, present: next, future: [] };
}

export function undo(history: History): { scene: Scene; history: History } {
  if (history.past.length === 0) return { scene: history.present, history };
  const previous = history.past[history.past.length - 1];
  const past = history.past.slice(0, -1);
  const future = [history.present, ...history.future];
  return { scene: previous, history: { past, present: previous, future } };
}

export function redo(history: History): { scene: Scene; history: History } {
  if (history.future.length === 0) return { scene: history.present, history };
  const [next, ...rest] = history.future;
  const past = [...history.past, history.present];
  return { scene: next, history: { past, present: next, future: rest } };
}
