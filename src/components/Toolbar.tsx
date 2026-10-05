import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Theme } from "../theme";

export type Mode = "fill" | "mark";

const TRACK_HEIGHT = 58;
const TRACK_PAD = 5;
const KNOB_HEIGHT = TRACK_HEIGHT - TRACK_PAD * 2;

/**
 * An iOS-style switch. The whole track is the tap target — a tap anywhere
 * moves the knob to the other side — so there is no small control to aim for
 * and no adjacent button to hit by mistake.
 *
 * The knob is a long rounded rectangle rather than a circle so the switch
 * keeps the width of a full-size button. Mode is readable from the corner of
 * your eye by knob position and colour, without reading the label.
 *
 * The knob jumps rather than slides: it is positioned outright instead of
 * being animated, which keeps the switch instant and leaves no chance of a
 * transform artifact trailing behind it.
 */
export function ModeToggle({
  mode,
  onChange,
  theme,
  width,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
  theme: Theme;
  width: number;
}) {
  const marking = mode === "mark";
  const knobWidth = (width - TRACK_PAD * 2) / 2;

  const knobColour = marking ? theme.mark : theme.cellFilled;
  const knobTextColour = marking ? theme.onMark : theme.cellEmpty;

  return (
    <Pressable
      onPress={() => onChange(marking ? "fill" : "mark")}
      accessibilityRole="switch"
      accessibilityState={{ checked: marking }}
      accessibilityLabel={marking ? "Mark mode" : "Fill mode"}
      accessibilityHint="Switches between filling cells and marking them"
      style={({ pressed }) => [
        styles.track,
        {
          width,
          backgroundColor: theme.surface,
          borderColor: theme.grid,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* The inactive side stays legible beside the knob. */}
      <View style={styles.labels} pointerEvents="none">
        <View style={styles.label}>
          <Text style={[styles.labelText, { color: theme.textDim }]}>Fill</Text>
        </View>
        <View style={styles.label}>
          <Text style={[styles.labelText, { color: theme.textDim }]}>Mark</Text>
        </View>
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.knob,
          {
            width: knobWidth,
            left: TRACK_PAD + (marking ? knobWidth : 0),
            backgroundColor: knobColour,
          },
        ]}
      >
        {marking ? (
          <Text style={[styles.knobGlyph, { color: knobTextColour }]}>×</Text>
        ) : (
          <View style={[styles.knobSquare, { backgroundColor: knobTextColour }]} />
        )}
        <Text style={[styles.knobText, { color: knobTextColour }]}>
          {marking ? "Mark" : "Fill"}
        </Text>
      </View>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  theme,
  variant = "plain",
  disabled,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
  variant?: "plain" | "primary";
  disabled?: boolean;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? theme.accent : theme.surface,
          borderColor: primary ? theme.accent : theme.grid,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: primary ? theme.accentText : theme.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    // Clips the knob to the track, so nothing can bleed past the rounded ends.
    overflow: "hidden",
  },
  labels: {
    position: "absolute",
    left: TRACK_PAD,
    right: TRACK_PAD,
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    flexDirection: "row",
  },
  label: { flex: 1, alignItems: "center", justifyContent: "center" },
  labelText: { fontSize: 16, fontWeight: "600" },
  knob: {
    position: "absolute",
    top: TRACK_PAD,
    height: KNOB_HEIGHT,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  knobSquare: { width: 17, height: 17, borderRadius: 4 },
  knobGlyph: { fontSize: 23, lineHeight: 27, fontWeight: "700" },
  knobText: { fontSize: 16, fontWeight: "700" },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
});
