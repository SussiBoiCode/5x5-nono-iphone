import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatTime } from "../format";
import type { Stats } from "../storage";
import type { Theme } from "../theme";

export default function StatsBar({
  stats,
  theme,
  width,
}: {
  stats: Stats;
  theme: Theme;
  /** Matched to the board so the row lines up with the grid above it. */
  width: number;
}) {
  const average = stats.solved > 0 ? formatTime(Math.round(stats.totalMs / stats.solved)) : "—";
  const items = [
    { label: "Solved", value: String(stats.solved) },
    { label: "Best", value: stats.bestMs === null ? "—" : formatTime(stats.bestMs) },
    { label: "Average", value: average },
  ];
  return (
    <View style={[styles.row, { width, backgroundColor: theme.surface, borderColor: theme.grid }]}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <Text style={[styles.value, { color: theme.text }]}>{item.value}</Text>
          <Text style={[styles.label, { color: theme.textDim }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  item: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  value: { fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
  label: { fontSize: 12, marginTop: 2 },
});
