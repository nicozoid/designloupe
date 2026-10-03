import type { Anomaly } from "../loupe-files";
import type { Mode, StaticFinding } from "../model";
import { anomalyCode } from "./codes";

const TITLES = { "colour-literal": "Hard-coded colour", "px-spacing": "Raw px spacing" } as const;
const CATEGORY = { "colour-literal": "color", "px-spacing": "structure" } as const;

export function findingsToAnomalies(findings: StaticFinding[]): Anomaly[] {
  const byCode = new Map<string, Anomaly>();
  for (const f of findings) {
    const loc = `${f.file}:${f.line}`;
    const existing = byCode.get(f.code);
    if (existing) {
      existing.locations.push(loc);
      continue;
    }
    byCode.set(f.code, {
      id: f.code,
      title: TITLES[f.rule],
      category: CATEGORY[f.rule],
      status: "open",
      flaggedBy: "system",
      description: `${f.message} \`${f.snippet}\``,
      locations: [loc],
    });
  }
  return [...byCode.values()];
}

export function contrastAnomaly(mode: Mode, label: string, ratio: number): Anomaly {
  return {
    id: anomalyCode("contrast", mode, label),
    title: `Low contrast: ${label} (${mode})`,
    category: "color",
    status: "open",
    flaggedBy: "system",
    description: `Measured ${ratio.toFixed(2)}:1; WCAG AA needs 4.5:1 for body text.`,
    locations: ["theme"],
  };
}

export function buildAnomaly(componentId: string, message: string): Anomaly {
  return {
    id: anomalyCode("build", componentId),
    title: `${componentId.split("#")[1] ?? componentId} failed to ${message.startsWith("import") ? "import" : "render"}`,
    category: "build",
    status: "open",
    flaggedBy: "system",
    description: message,
    locations: [componentId.split("#")[0]!],
  };
}
