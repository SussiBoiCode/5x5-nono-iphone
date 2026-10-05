/**
 * 5x5 nonogram engine. Everything here is pure and runs on-device:
 * clue derivation, exhaustive solution counting, and puzzle generation
 * that only emits grids with exactly one solution.
 *
 * Lines are encoded as bitmasks (bit i = cell i is filled) because N is
 * small enough that enumerating every legal line placement is cheap.
 */

export const SIZE = 5;
/** Widest clue a 5-cell line can have: [1, 1, 1]. */
export const MAX_CLUES = 3;

export type Grid = boolean[][];
export type Clue = number[];

export type Puzzle = {
  solution: Grid;
  rowClues: Clue[];
  colClues: Clue[];
};

/** Run lengths of filled cells, e.g. [true,true,false,true] -> [2,1]. */
export function clueForLine(line: boolean[]): Clue {
  const clue: Clue = [];
  let run = 0;
  for (const filled of line) {
    if (filled) {
      run++;
    } else if (run > 0) {
      clue.push(run);
      run = 0;
    }
  }
  if (run > 0) clue.push(run);
  return clue;
}

export function cluesForGrid(grid: Grid): { rowClues: Clue[]; colClues: Clue[] } {
  const rowClues = grid.map(clueForLine);
  const colClues: Clue[] = [];
  for (let c = 0; c < SIZE; c++) {
    colClues.push(clueForLine(grid.map((row) => row[c])));
  }
  return { rowClues, colClues };
}

/**
 * Every bitmask of `length` cells whose runs match `clue`.
 * An empty clue yields exactly one pattern: the empty line.
 */
export function patternsForClue(clue: Clue, length = SIZE): number[] {
  const out: number[] = [];

  const place = (index: number, from: number, mask: number) => {
    if (index === clue.length) {
      out.push(mask);
      return;
    }
    // Space the remaining runs still need, including one gap before each.
    let tail = 0;
    for (let i = index + 1; i < clue.length; i++) tail += clue[i] + 1;
    const run = clue[index];
    const lastStart = length - tail - run;
    for (let start = from; start <= lastStart; start++) {
      let next = mask;
      for (let k = 0; k < run; k++) next |= 1 << (start + k);
      place(index + 1, start + run + 1, next);
    }
  };

  place(0, 0, 0);
  return out;
}

/**
 * Counts solutions for a clue pair, stopping once `limit` is reached.
 * Rows are chosen one at a time; each choice filters the surviving column
 * candidates, so contradictions are caught immediately instead of at the end.
 */
export function countSolutions(rowClues: Clue[], colClues: Clue[], limit = 2): number {
  const rowCandidates = rowClues.map((clue) => patternsForClue(clue));
  if (rowCandidates.some((list) => list.length === 0)) return 0;

  let found = 0;

  const search = (row: number, colCandidates: number[][]) => {
    if (found >= limit) return;
    if (row === SIZE) {
      found++;
      return;
    }
    for (const rowMask of rowCandidates[row]) {
      const next: number[][] = [];
      let viable = true;
      for (let c = 0; c < SIZE; c++) {
        const bit = (rowMask >> c) & 1;
        const survivors = colCandidates[c].filter((p) => ((p >> row) & 1) === bit);
        if (survivors.length === 0) {
          viable = false;
          break;
        }
        next.push(survivors);
      }
      if (viable) search(row + 1, next);
      if (found >= limit) return;
    }
  };

  search(0, colClues.map((clue) => patternsForClue(clue)));
  return found;
}

export function hasUniqueSolution(rowClues: Clue[], colClues: Clue[]): boolean {
  return countSolutions(rowClues, colClues, 2) === 1;
}

/**
 * Solves the puzzle the way a person does: one row or column at a time, a
 * cell is settled when every placement of that line's clue that fits the
 * cells already settled agrees on it. Repeats until nothing changes.
 *
 * Returns true only if that alone fills the whole board. A unique solution is
 * not enough: some unique boards (often ones full of 1s) stall partway and
 * can only be finished by guessing. Every deduction here is forced, so a
 * board this solves also has exactly one solution.
 */
export function isSolvableByLogic(rowClues: Clue[], colClues: Clue[]): boolean {
  const full = (1 << SIZE) - 1;
  // Per row: bitmasks of cells known filled and known empty.
  const filled = new Array<number>(SIZE).fill(0);
  const empty = new Array<number>(SIZE).fill(0);
  const rowPatterns = rowClues.map((clue) => patternsForClue(clue));
  const colPatterns = colClues.map((clue) => patternsForClue(clue));

  const colMasks = (c: number) => {
    let f = 0;
    let e = 0;
    for (let r = 0; r < SIZE; r++) {
      if ((filled[r] >> c) & 1) f |= 1 << r;
      if ((empty[r] >> c) & 1) e |= 1 << r;
    }
    return { f, e };
  };

  /** Cells every fitting pattern agrees on, or null if none fits. */
  const settle = (patterns: number[], f: number, e: number) => {
    let allFilled = full;
    let allEmpty = full;
    let any = false;
    for (const p of patterns) {
      if ((p & e) !== 0 || (p & f) !== f) continue;
      any = true;
      allFilled &= p;
      allEmpty &= ~p & full;
    }
    return any ? { f: allFilled, e: allEmpty } : null;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < SIZE; r++) {
      const next = settle(rowPatterns[r], filled[r], empty[r]);
      if (!next) return false;
      if (next.f !== filled[r] || next.e !== empty[r]) {
        filled[r] = next.f;
        empty[r] = next.e;
        changed = true;
      }
    }
    for (let c = 0; c < SIZE; c++) {
      const known = colMasks(c);
      const next = settle(colPatterns[c], known.f, known.e);
      if (!next) return false;
      if (next.f === known.f && next.e === known.e) continue;
      for (let r = 0; r < SIZE; r++) {
        if ((next.f >> r) & 1) filled[r] |= 1 << c;
        if ((next.e >> r) & 1) empty[r] |= 1 << c;
      }
      changed = true;
    }
  }
  return filled.every((f, r) => (f | empty[r]) === full);
}

function randomGrid(density: number): Grid {
  const grid: Grid = [];
  for (let r = 0; r < SIZE; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < SIZE; c++) row.push(Math.random() < density);
    grid.push(row);
  }
  return grid;
}

function isWellFormed(grid: Grid): boolean {
  let filled = 0;
  for (const row of grid) for (const cell of row) if (cell) filled++;
  // Too sparse is trivial, too dense is a solid block; both are dull.
  if (filled < 7 || filled > 18) return false;
  // Blank rows or columns read as an all-zero clue and look like a bug.
  for (let i = 0; i < SIZE; i++) {
    if (!grid[i].some(Boolean)) return false;
    if (!grid.some((row) => row[i])) return false;
  }
  return true;
}

/**
 * Generates a random 5x5 puzzle that can be solved start to finish without
 * guessing (which also means it has exactly one solution).
 */
export function generatePuzzle(): Puzzle {
  for (let attempt = 0; attempt < 500; attempt++) {
    const density = 0.42 + Math.random() * 0.22;
    const solution = randomGrid(density);
    if (!isWellFormed(solution)) continue;
    const { rowClues, colClues } = cluesForGrid(solution);
    if (!isSolvableByLogic(rowClues, colClues)) continue;
    return { solution, rowClues, colClues };
  }
  // Statistically unreachable, but never hand back a broken board.
  const solution = [
    [true, false, true, false, true],
    [false, true, true, true, false],
    [true, true, false, true, true],
    [false, true, true, true, false],
    [true, false, true, false, true],
  ];
  return { solution, ...cluesForGrid(solution) };
}
