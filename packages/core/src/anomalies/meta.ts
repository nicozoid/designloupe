/**
 * Anomaly display metadata — the per-category labels + descriptions and
 * per-status pill names + tones the Anomalies page renders. Both describe
 * the fixed category / status enums rather than any app's anomaly list,
 * so they live in the shared package.
 */

import type { AnomalyCategory, AnomalyStatus } from "../loupe-files"

export const categoryInfo: Record<
  AnomalyCategory,
  { name: string; description: string }
> = {
  color: {
    name: "Colour",
    description: "Hex / rgb literals, opacity drift, missing tokens.",
  },
  typography: {
    name: "Typography",
    description: "Inline font sizes/weights instead of typography variants.",
  },
  structure: {
    name: "Structure",
    description: "Layout, sizing, or spacing values that drift across callsites.",
  },
  iconography: {
    name: "Iconography",
    description: "Icon-library mixing, asset duplication, missing variants.",
  },
  motion: {
    name: "Motion",
    description: "Inconsistent durations or easings between similar effects.",
  },
  external: {
    name: "External",
    description: "Anomalies outside this codebase — third-party styles or config.",
  },
  build: {
    name: "Build",
    description: "Components Loupe could not import or render — usually a missing shim, provider or env value.",
  },
}

export const statusInfo: Record<
  AnomalyStatus,
  { name: string; tone: "warn" | "info" | "good" | "muted" }
> = {
  open: { name: "Open", tone: "warn" },
  intentional: { name: "Intentional", tone: "muted" },
  todo: { name: "Todo", tone: "info" },
  fixed: { name: "Fixed", tone: "good" },
}
