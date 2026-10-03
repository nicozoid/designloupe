import { it, expect } from "vitest";
import { findingsToAnomalies, contrastAnomaly, buildAnomaly } from "./auto";
import type { StaticFinding } from "../model";

const f = (o: Partial<StaticFinding>): StaticFinding => ({ code: "ab12", rule: "colour-literal", file: "src/a.tsx", line: 3, snippet: "color: #fff", message: "Hard-coded colour in styles; use a palette token.", ...o });

it("turns static findings into anomalies, merging identical codes", () => {
  const a = findingsToAnomalies([f({}), f({ line: 9 }), f({ code: "cd34", rule: "px-spacing", snippet: "px: 6px", message: "Raw px spacing; use theme.spacing units." })]);
  expect(a).toHaveLength(2);
  expect(a[0]).toMatchObject({ id: "ab12", title: "Hard-coded colour", category: "color", status: "open", flaggedBy: "system", locations: ["src/a.tsx:3", "src/a.tsx:9"] });
  expect(a[0]!.description).toContain("color: #fff");
  expect(a[1]).toMatchObject({ id: "cd34", title: "Raw px spacing", category: "structure" });
});

it("builds contrast and build anomalies with stable codes", () => {
  const c = contrastAnomaly("light", "warning text on main", 1.62);
  expect(c).toMatchObject({ category: "color", status: "open", title: "Low contrast: warning text on main (light)" });
  expect(c.id).toBe(contrastAnomaly("light", "warning text on main", 1.7).id);
  const b = buildAnomaly("src/components/Broken.tsx#Broken", "render: Broken on purpose");
  expect(b).toMatchObject({ category: "build", locations: ["src/components/Broken.tsx"] });
  expect(b.id).toMatch(/^[0-9a-z]{4}$/);
});
