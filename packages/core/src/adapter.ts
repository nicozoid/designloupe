import type { ComponentType, ReactNode } from "react";
import type { Mode } from "./model";

/** Node-side half of an adapter: used during discovery. */
export interface AdapterNode {
  id: string;            // "mui"
  libraryName: string;   // "MUI"
  packageName: string;   // "@mui/material", for reading the version from the target
  /** e.g. ("@mui/material", "Button") → "Button"; ("@mui/material/Button", "default") → "Button"; non-components → null */
  classifyImport(specifier: string, imported: string): string | null;
  /** e.g. ("@mui/icons-material/Delete", "default") → "Delete" */
  classifyIconImport(specifier: string, imported: string): string | null;
  /** Library components that never make a component "wrap" them (layout/text primitives), e.g. Box, Stack, Typography. */
  layoutPrimitives: string[];
}

export interface ColourToken { path: string; value: string }
export interface PaletteGroup { name: string; tokens: ColourToken[] }
export interface TypographyToken { variant: string; style: Record<string, string | number>; responsive: { query: string; style: Record<string, string | number> }[] }
export interface TokenModel {
  schemes: { mode: Mode; groups: PaletteGroup[] }[];
  typography: TypographyToken[];
  spacing: { factor: number; value: string }[];
  shape: { name: string; value: string }[];
  shadows: string[];
  zIndex: { name: string; value: number }[];
  transitions: { durations: { name: string; ms: number }[]; easings: { name: string; value: string }[] };
  breakpoints: { name: string; min: number }[];
}
export interface OverrideEntry {
  key: string;           // "MuiButton"
  component: string;     // "Button"
  defaultProps?: string; // serialised source
  styleOverrides?: string;
  variants?: { props: string; style: string }[];
}
export interface ContrastPair { mode: Mode; label: string; fg: string; bg: string; kind: "text" | "ui" }

/** Browser-side half of an adapter: used by the viewer. */
export interface AdapterBrowser {
  id: string;
  libraryName: string;
  isTheme(value: unknown): boolean;
  hasDarkScheme(theme: unknown): boolean;
  readTokens(theme: unknown): TokenModel;
  readOverrides(theme: unknown): OverrideEntry[];
  /** Token path ("palette.primary.main") → colour string for a mode. */
  resolveColour(theme: unknown, mode: Mode, path: string): string | undefined;
  /** Pairs worth checking for contrast. Colours are token paths. */
  contrastPairs(theme: unknown): ContrastPair[];
  PreviewRoot: ComponentType<{ theme: unknown; mode: Mode; children: ReactNode }>;
  PreviewFrame: ComponentType<{ children: ReactNode }>;
  DefaultThemeFrame: ComponentType<{ children: ReactNode }>;
  TypographySample: ComponentType<{ variant: string; children: ReactNode }>;
  /** A small representative render of a library component (for override before/after), or null. */
  sampleFor(component: string, props?: Record<string, unknown>): ReactNode | null;
}
