import React, { useCallback, useRef } from "react";
import { GestureResponderEvent, StyleSheet, Text, View } from "react-native";
import { SIZE, type Clue } from "../game/nonogram";
import type { CellState } from "../storage";
import type { Theme } from "../theme";

/** Grid border (2) + inner padding (2) on each side. */
const GRID_INSET = 4;

type Props = {
  cells: CellState[][];
  rowClues: Clue[];
  colClues: Clue[];
  rowDone: boolean[];
  colDone: boolean[];
  solved: boolean;
  theme: Theme;
  cellSize: number;
  gutter: number;
  /** Value the whole drag should paint, decided by the first cell touched. */
  resolvePaintValue: (row: number, col: number) => CellState;
  onPaintCell: (row: number, col: number, value: CellState) => void;
};

export default function Board({
  cells,
  rowClues,
  colClues,
  rowDone,
  colDone,
  solved,
  theme,
  cellSize,
  gutter,
  resolvePaintValue,
  onPaintCell,
}: Props) {
  const gridRef = useRef<View>(null);
  // Grid origin in window coordinates; pageX/pageY are the only touch
  // coordinates that stay meaningful once a finger crosses child views.
  const origin = useRef({ x: 0, y: 0 });
  const paintValue = useRef<CellState | null>(null);
  const lastCell = useRef<string | null>(null);

  const measure = useCallback(() => {
    gridRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
  }, []);

  const cellAt = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    // The first cell starts inside the grid's border and padding.
    const col = Math.floor((pageX - origin.current.x - GRID_INSET) / cellSize);
    const row = Math.floor((pageY - origin.current.y - GRID_INSET) / cellSize);
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    return { row, col };
  };

  const onGrant = (event: GestureResponderEvent) => {
    const hit = cellAt(event);
    if (!hit) return;
    const value = resolvePaintValue(hit.row, hit.col);
    paintValue.current = value;
    lastCell.current = `${hit.row},${hit.col}`;
    onPaintCell(hit.row, hit.col, value);
  };

  const onMove = (event: GestureResponderEvent) => {
    if (paintValue.current === null) return;
    const hit = cellAt(event);
    if (!hit) return;
    const key = `${hit.row},${hit.col}`;
    if (key === lastCell.current) return;
    lastCell.current = key;
    onPaintCell(hit.row, hit.col, paintValue.current);
  };

  const endPaint = () => {
    paintValue.current = null;
    lastCell.current = null;
  };

  const clueFontSize = Math.round(cellSize * 0.34);

  return (
    <View>
      {/* Column clues, bottom-aligned so they sit against the grid. */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: gutter, height: gutter }} />
        {colClues.map((clue, c) => (
          <View
            key={`col-${c}`}
            style={[styles.colClue, { width: cellSize, height: gutter }]}
          >
            {(clue.length ? clue : [0]).map((n, i) => (
              <Text
                key={i}
                style={{
                  fontSize: clueFontSize,
                  lineHeight: clueFontSize * 1.25,
                  fontVariant: ["tabular-nums"],
                  fontWeight: "600",
                  color: colDone[c] ? theme.textDim : theme.text,
                }}
              >
                {n}
              </Text>
            ))}
          </View>
        ))}
        {/* Mirrors the clue gutter so the grid sits centred on screen. */}
        <View style={{ width: gutter }} />
      </View>

      <View style={{ flexDirection: "row" }}>
        {/* Row clues, right-aligned against the grid. */}
        <View style={{ width: gutter }}>
          {rowClues.map((clue, r) => (
            <View
              key={`row-${r}`}
              style={[styles.rowClue, { width: gutter, height: cellSize }]}
            >
              {(clue.length ? clue : [0]).map((n, i) => (
                <Text
                  key={i}
                  style={{
                    fontSize: clueFontSize,
                    marginLeft: clueFontSize * 0.35,
                    fontVariant: ["tabular-nums"],
                    fontWeight: "600",
                    color: rowDone[r] ? theme.textDim : theme.text,
                  }}
                >
                  {n}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View
          ref={gridRef}
          onLayout={measure}
          collapsable={false}
          onStartShouldSetResponder={() => !solved}
          onMoveShouldSetResponder={() => !solved}
          onResponderGrant={onGrant}
          onResponderMove={onMove}
          onResponderRelease={endPaint}
          onResponderTerminate={endPaint}
          style={[
            styles.grid,
            {
              borderColor: theme.gridStrong,
              backgroundColor: theme.grid,
              width: cellSize * SIZE + GRID_INSET * 2,
              height: cellSize * SIZE + GRID_INSET * 2,
            },
          ]}
        >
          {/* Cells never take the touch themselves; the grid owns the gesture. */}
          <View pointerEvents="none">
            {cells.map((row, r) => (
              <View key={r} style={{ flexDirection: "row" }}>
                {row.map((state, c) => (
                  <View
                    key={c}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRightWidth: c === SIZE - 1 ? 0 : StyleSheet.hairlineWidth,
                      borderBottomWidth: r === SIZE - 1 ? 0 : StyleSheet.hairlineWidth,
                      borderColor: theme.grid,
                      backgroundColor:
                        state === 1
                          ? solved
                            ? theme.accent
                            : theme.cellFilled
                          : theme.cellEmpty,
                    }}
                  >
                    {state === 2 && (
                      <Text
                        style={{
                          fontSize: cellSize * 0.66,
                          lineHeight: cellSize * 0.78,
                          color: theme.mark,
                          fontWeight: "700",
                        }}
                      >
                        ×
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
        <View style={{ width: gutter }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  colClue: { alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 },
  rowClue: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 },
  grid: { borderWidth: 2, borderRadius: 10, overflow: "hidden", padding: 2 },
});
