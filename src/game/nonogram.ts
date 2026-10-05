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

/** Generates a random 5x5 puzzle that has exactly one solution. */
export function generatePuzzle(): Puzzle {
  for (let attempt = 0; attempt < 500; attempt++) {
    const density = 0.42 + Math.random() * 0.22;
    const solution = randomGrid(density);
    if (!isWellFormed(solution)) continue;
    const { rowClues, colClues } = cluesForGrid(solution);
    if (!hasUniqueSolution(rowClues, colClues)) continue;
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
