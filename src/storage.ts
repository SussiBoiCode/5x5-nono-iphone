/**
 * Local-only persistence. Nothing here touches the network: AsyncStorage is
 * backed by a file in the app sandbox, so stats and the in-progress board
 * survive a relaunch even with the device in airplane mode.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Clue, Grid } from "./game/nonogram";

const STATS_KEY = "nono5:stats:v1";
const SESSION_KEY = "nono5:session:v1";

export type Stats = {
  solved: number;
  bestMs: number | null;
  totalMs: number;
};

export const EMPTY_STATS: Stats = { solved: 0, bestMs: null, totalMs: 0 };

/** 0 = untouched, 1 = filled, 2 = marked with an X. */
export type CellState = 0 | 1 | 2;

export type Session = {
  solution: Grid;
  rowClues: Clue[];
  colClues: Clue[];
  cells: CellState[][];
  elapsedMs: number;
};

export async function loadStats(): Promise<Stats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (!raw) return EMPTY_STATS;
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return {
      solved: typeof parsed.solved === "number" ? parsed.solved : 0,
      bestMs: typeof parsed.bestMs === "number" ? parsed.bestMs : null,
      totalMs: typeof parsed.totalMs === "number" ? parsed.totalMs : 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

export async function saveStats(stats: Stats): Promise<void> {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // A failed write costs a stat, not the game in progress.
  }
}

export function recordSolve(stats: Stats, elapsedMs: number): Stats {
  return {
    solved: stats.solved + 1,
    bestMs: stats.bestMs === null ? elapsedMs : Math.min(stats.bestMs, elapsedMs),
    totalMs: stats.totalMs + elapsedMs,
  };
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    // Guard against a partially written or older-shaped payload.
    const ok =
      Array.isArray(s?.solution) &&
      s.solution.length === 5 &&
      Array.isArray(s?.cells) &&
      s.cells.length === 5 &&
      Array.isArray(s?.rowClues) &&
      Array.isArray(s?.colClues);
    return ok ? s : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore: the board stays playable in memory.
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore.
  }
}

export async function resetStats(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STATS_KEY);
  } catch {
    // Ignore.
  }
}
