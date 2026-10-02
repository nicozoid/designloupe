import { it, expect } from "vitest";
import { theme } from "../../../examples/mui-fixture/src/theme";
import { readOverrides } from "./overrides";

it("lists customised components with serialised defaultProps, styleOverrides and variants", () => {
  const o = readOverrides(theme);
  expect(o.map((x) => x.key)).toEqual(["MuiButton", "MuiCard", "MuiTextField"]);
  const btn = o[0]!;
  expect(btn.component).toBe("Button");
  expect(btn.defaultProps).toContain("disableElevation: true");
  expect(btn.styleOverrides).toContain('textTransform: "none"');
  expect(btn.variants).toHaveLength(1);
  expect(btn.variants![0]!.props).toContain('variant: "dashed"');
  expect(btn.variants![0]!.style).toContain("dashed");
  expect(o[1]!.styleOverrides).toBeUndefined();
});
