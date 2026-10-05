import { useColorScheme } from "react-native";

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  text: string;
  textDim: string;
  grid: string;
  gridStrong: string;
  cellEmpty: string;
  cellFilled: string;
  mark: string;
  /** Text/glyph colour that sits on top of `mark`. */
  onMark: string;
  accent: string;
  accentText: string;
  error: string;
};

const light: Theme = {
  dark: false,
  bg: "#F6F6F8",
  surface: "#FFFFFF",
  text: "#101014",
  textDim: "#8A8A93",
  grid: "#D8D8DE",
  gridStrong: "#101014",
  cellEmpty: "#FFFFFF",
  cellFilled: "#1B1B20",
  mark: "#5C5C6B",
  onMark: "#FFFFFF",
  accent: "#2F6BFF",
  accentText: "#FFFFFF",
  error: "#D4383D",
};

const dark: Theme = {
  dark: true,
  bg: "#0E0E11",
  surface: "#17171C",
  text: "#F2F2F5",
  textDim: "#77777F",
  grid: "#2C2C34",
  gridStrong: "#5A5A66",
  cellEmpty: "#17171C",
  cellFilled: "#F2F2F5",
  mark: "#A8A8BA",
  onMark: "#0E0E11",
  accent: "#4C86FF",
  accentText: "#0E0E11",
  error: "#FF6B6F",
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
