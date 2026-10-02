import type { ReactNode } from "react";
import type { WcagCheck } from "./a11y/types";
import type { ApgPattern } from "./a11y/wcag-meta";

export type Tier = "atom" | "molecule" | "macromolecule" | "organelle";
export const TIERS: Tier[] = ["atom", "molecule", "macromolecule", "organelle"];

export interface A11yDoc {
  pattern?: ApgPattern;
  role?: string;
  name?: string;               // how the accessible name is derived
  keyboard?: { keys: string; does: string }[];
  checks?: WcagCheck[];
}

export interface ComponentDocInput {
  /** File path relative to the target root, optionally `#ExportName`. */
  component: string;
  tier?: Tier;
  notes?: string;
  hidden?: boolean;
  demo?: () => ReactNode;
  a11y?: A11yDoc;
}

export type AnomalyCategory = "color" | "typography" | "structure" | "iconography" | "motion" | "external" | "build";
export type AnomalyStatus = "open" | "intentional" | "todo" | "fixed";

export interface Anomaly {
  id: string;                  // 4-char base36, stable
  title: string;
  category: AnomalyCategory;
  status: AnomalyStatus;
  flaggedBy?: "system" | "human";
  description: string;
  locations: string[];
  fix?: string;
  note?: string;
}

export type TokenNotes = Record<string, string>;

export const defineComponentDoc = (d: ComponentDocInput) => d;
export const defineAnomalies = (a: Anomaly[]) => a;
export const defineTokenNotes = (n: TokenNotes) => n;
