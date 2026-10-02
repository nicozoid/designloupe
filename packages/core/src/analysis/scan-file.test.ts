import { describe, it, expect } from "vitest";
import { scanSource } from "./scan-file";

const src = `
import Button, { type ButtonProps } from "@mui/material/Button";
import { Card as MuiCard, Typography } from "@mui/material";
import * as Icons from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import { StatusPill } from "./StatusPill";

const Wrap = styled(MuiCard)({});
export const A = () => <MuiCard><Typography.Root /><Button /><StatusPill status="ok" label="x" /></MuiCard>;
export default function B() { return <Icons.Delete />; }
export { A as Alias };
`;

describe("scanSource", () => {
  it("collects imports, jsx tags with lines, styled targets and exports", () => {
    const s = scanSource("/r/src/x.tsx", src, (spec) => (spec === "./StatusPill" ? "/r/src/StatusPill.tsx" : undefined));
    expect(s.imports).toEqual([
      { local: "Button", imported: "default", specifier: "@mui/material/Button" },
      { local: "ButtonProps", imported: "ButtonProps", specifier: "@mui/material/Button" },
      { local: "MuiCard", imported: "Card", specifier: "@mui/material" },
      { local: "Typography", imported: "Typography", specifier: "@mui/material" },
      { local: "Icons", imported: "*", specifier: "@mui/icons-material" },
      { local: "styled", imported: "styled", specifier: "@mui/material/styles" },
      { local: "StatusPill", imported: "StatusPill", specifier: "./StatusPill", resolvedFile: "/r/src/StatusPill.tsx" },
    ]);
    expect(s.jsx.map((j) => j.tag)).toEqual(["MuiCard", "Typography", "Button", "StatusPill", "Icons"]);
    expect(s.jsx[0]!.line).toBe(9);
    expect(s.styledTargets).toEqual(["MuiCard"]);
    expect(s.exports.sort()).toEqual(["A", "Alias", "default"]);
    expect(s.reExports).toEqual([]);
  });

  it("records re-exports from barrel files", () => {
    const barrel = `export { PrimaryButton as Btn } from "./PrimaryButton";\nexport * from "./InfoCard";\n`;
    const s = scanSource("/r/src/index.ts", barrel, (spec) => `/r/src/${spec.slice(2)}.tsx`);
    expect(s.reExports).toEqual([
      { exported: "Btn", imported: "PrimaryButton", specifier: "./PrimaryButton", resolvedFile: "/r/src/PrimaryButton.tsx" },
      { exported: "*", imported: "*", specifier: "./InfoCard", resolvedFile: "/r/src/InfoCard.tsx" },
    ]);
    expect(s.exports).toEqual(["Btn"]);
  });
});
