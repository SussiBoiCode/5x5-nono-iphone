import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Board from "./src/components/Board";
import StatsBar from "./src/components/StatsBar";
import { Button, ModeToggle, type Mode } from "./src/components/Toolbar";
import { formatTime } from "./src/format";
import { SIZE, clueForLine, generatePuzzle, type Puzzle } from "./src/game/nonogram";
import {
  EMPTY_STATS,
  clearSession,
  loadSession,
  loadStats,
  recordSolve,
  saveSession,
  saveStats,
  type CellState,
  type Stats,
} from "./src/storage";
import { useTheme } from "./src/theme";

const emptyCells = (): CellState[][] =>
  Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0 as CellState));

const tap = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
};

const cheer = () => {
  if (Platform.OS !== "web") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
};

export default function App() {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const [ready, setReady] = useState(false);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [cells, setCells] = useState<CellState[][]>(emptyCells);
  const [mode, setMode] = useState<Mode>("fill");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [solved, setSolved] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [active, setActive] = useState(true);

  const board = useMemo(() => {
    const available = Math.min(width - 32, 440);
    // The grid is flanked by a clue gutter on the left and an equal spacer on
    // the right so the grid itself lands in the centre of the screen. That
    // costs a little cell size: 5 cells + 2 gutters (1.3 cells each) + 8px of
    // border and padding all have to fit across.
    const cellSize = Math.floor((available - 8) / (SIZE + 2 * 1.3));
    const gutter = Math.round(cellSize * 1.3);
    return { cellSize, gutter, total: gutter * 2 + cellSize * SIZE + 8 };
  }, [width]);

  // Restore the saved board, or deal a fresh one on first launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedStats, session] = await Promise.all([loadStats(), loadSession()]);
      if (cancelled) return;
      setStats(savedStats);
      if (session) {
        setPuzzle({
          solution: session.solution,
          rowClues: session.rowClues,
          colClues: session.colClues,
        });
        setCells(session.cells);
        setElapsedMs(session.elapsedMs);
      } else {
        setPuzzle(generatePuzzle());
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pause the stopwatch while the app is backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
    });
    return () => sub.remove();
  }, []);

  const running = ready && active && !solved && puzzle !== null;

  const lastTick = useRef(Date.now());
  useEffect(() => {
    if (!running) return;
    lastTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick.current;
      lastTick.current = now;
      setElapsedMs((previous) => previous + delta);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  // Persist the board whenever it changes so a relaunch resumes mid-puzzle.
  // elapsedMs is saved but deliberately left out of the deps: the stopwatch
  // ticks ten times a second and writing that often would be wasteful.
  const elapsedRef = useRef(elapsedMs);
  elapsedRef.current = elapsedMs;
  useEffect(() => {
    if (!ready || !puzzle || solved) return;
    saveSession({
      solution: puzzle.solution,
      rowClues: puzzle.rowClues,
      colClues: puzzle.colClues,
      cells,
      elapsedMs: elapsedRef.current,
    });
  }, [cells, puzzle, ready, solved]);

  // Also flush the elapsed time when the app leaves the foreground.
  useEffect(() => {
    if (active || !ready || !puzzle || solved) return;
    saveSession({
      solution: puzzle.solution,
      rowClues: puzzle.rowClues,
      colClues: puzzle.colClues,
      cells,
      elapsedMs: elapsedRef.current,
    });
  }, [active, cells, puzzle, ready, solved]);

  const isSolved = useCallback((grid: CellState[][], solution: boolean[][]) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((grid[r][c] === 1) !== solution[r][c]) return false;
      }
    }
    return true;
  }, []);

  const finish = useCallback((finalMs: number) => {
    setSolved(true);
    cheer();
    setStats((previous) => {
      setNewBest(previous.bestMs === null || finalMs < previous.bestMs);
      const updated = recordSolve(previous, finalMs);
      saveStats(updated);
      return updated;
    });
    clearSession();
  }, []);

  const resolvePaintValue = useCallback(
    (row: number, col: number): CellState => {
      const current = cells[row][col];
      if (mode === "fill") return current === 1 ? 0 : 1;
      return current === 2 ? 0 : 2;
    },
    [cells, mode]
  );

  const onPaintCell = useCallback(
    (row: number, col: number, value: CellState) => {
      if (!puzzle || solved) return;
      setCells((previous) => {
        if (previous[row][col] === value) return previous;
        const next = previous.map((r) => r.slice()) as CellState[][];
        next[row][col] = value;
        tap();
        if (isSolved(next, puzzle.solution)) {
          // Read the stopwatch once, at the moment the last cell lands.
          finish(elapsedRef.current);
        }
        return next;
      });
    },
    [finish, isSolved, puzzle, solved]
  );

  const newPuzzle = useCallback(() => {
    setPuzzle(generatePuzzle());
    setCells(emptyCells());
    setElapsedMs(0);
    setSolved(false);
    setNewBest(false);
    setMode("fill");
    lastTick.current = Date.now();
  }, []);

  const clearBoard = useCallback(() => {
    if (solved) return;
    setCells(emptyCells());
  }, [solved]);

  // A clue line reads as "done" once the filled cells match it exactly.
  const { rowDone, colDone } = useMemo(() => {
    if (!puzzle) return { rowDone: [] as boolean[], colDone: [] as boolean[] };
    const same = (a: number[], b: number[]) =>
      a.length === b.length && a.every((n, i) => n === b[i]);
    const rows = puzzle.rowClues.map((clue, r) =>
      same(clueForLine(cells[r].map((s) => s === 1)), clue)
    );
    const cols = puzzle.colClues.map((clue, c) =>
      same(clueForLine(cells.map((row) => row[c] === 1)), clue)
    );
    return { rowDone: rows, colDone: cols };
  }, [cells, puzzle]);

  if (!ready || !puzzle) {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <StatusBar style={theme.dark ? "light" : "dark"} />
        <SafeAreaView style={[styles.screen, styles.center]}>
          <Text style={{ color: theme.textDim }}>Loading</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    // The background View deliberately sits OUTSIDE SafeAreaView so it paints
    // the full window, including behind the status bar and the home indicator.
    // SafeAreaView is transparent and only insets the content.
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Nonogram 5x5</Text>
          <Text style={[styles.clock, { color: solved ? theme.accent : theme.textDim }]}>
            {formatTime(elapsedMs)}
          </Text>
        </View>

        <Board
          cells={cells}
          rowClues={puzzle.rowClues}
          colClues={puzzle.colClues}
          rowDone={rowDone}
          colDone={colDone}
          solved={solved}
          theme={theme}
          cellSize={board.cellSize}
          gutter={board.gutter}
          resolvePaintValue={resolvePaintValue}
          onPaintCell={onPaintCell}
        />

        {solved ? (
          <View style={styles.controls}>
            <Text style={[styles.solvedText, { color: theme.accent }]}>
              {newBest
                ? "New best - " + formatTime(elapsedMs)
                : "Solved in " + formatTime(elapsedMs)}
            </Text>
            <Button label="New puzzle" onPress={newPuzzle} theme={theme} variant="primary" />
          </View>
        ) : (
          <View style={styles.controls}>
            {/* Clear and New puzzle sit above the switch: overshooting the
                switch now lands on the stats row instead of wiping the board. */}
            <View style={styles.buttonRow}>
              <Button label="Clear" onPress={clearBoard} theme={theme} />
              <Button label="New puzzle" onPress={newPuzzle} theme={theme} />
            </View>
            <ModeToggle mode={mode} onChange={setMode} theme={theme} width={board.total} />
          </View>
        )}

          <StatsBar stats={stats} theme={theme} width={board.total} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Full-window background: must not be inset, or the safe areas show white. */
  root: { flex: 1 },
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 22,
  },
  header: { alignItems: "center", gap: 4 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  clock: { fontSize: 32, fontWeight: "300", fontVariant: ["tabular-nums"] },
  controls: { alignItems: "center", gap: 12 },
  buttonRow: { flexDirection: "row", gap: 12 },
  solvedText: { fontSize: 17, fontWeight: "600" },
});
