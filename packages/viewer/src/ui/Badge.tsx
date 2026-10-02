import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "good" | "warn" | "bad";
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`dl-badge dl-badge--${tone}`}>{children}</span>;
}
