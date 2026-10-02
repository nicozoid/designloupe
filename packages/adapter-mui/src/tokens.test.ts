import { describe, it, expect } from "vitest";
import { createTheme } from "@mui/material/styles";
import { theme } from "../../../examples/mui-fixture/src/theme";
import { readTokens, resolveColour, contrastPairs } from "./tokens";

describe("readTokens", () => {
  const t = readTokens(theme);

  it("reads both colour schemes with custom palette keys, skipping channels and component palettes", () => {
    expect(t.schemes.map((s) => s.mode)).toEqual(["light", "dark"]);
    const light = t.schemes[0]!;
    const names = light.groups.map((g) => g.name);
    expect(names).toEqual(expect.arrayContaining(["primary", "secondary", "brand", "warning", "text", "background", "grey", "divider"]));
    expect(names.some((n) => /^[A-Z]/.test(n))).toBe(false);
    const primary = light.groups.find((g) => g.name === "primary")!;
    expect(primary.tokens).toContainEqual({ path: "palette.primary.main", value: "#2f6544" });
    expect(primary.tokens.some((tk) => tk.path.endsWith("Channel"))).toBe(false);
  });

  it("reads typography variants including custom ones", () => {
    const variants = t.typography.map((v) => v.variant);
    expect(variants).toEqual(expect.arrayContaining(["h1", "h6", "body1", "button", "caption", "overline", "eyebrow"]));
    expect(t.typography.find((v) => v.variant === "eyebrow")!.style.letterSpacing).toBe("0.12em");
  });

  it("reads spacing, shape, shadows, zIndex, transitions, breakpoints", () => {
    expect(t.spacing.map((s) => s.factor)).toEqual([0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12]);
    expect(t.shape).toEqual([{ name: "borderRadius", value: "10px" }]);
    expect(t.shadows).toHaveLength(25);
    expect(t.zIndex.find((z) => z.name === "modal")!.value).toBe(1300);
    expect(t.transitions.durations.find((d) => d.name === "short")!.ms).toBe(250);
    expect(t.transitions.easings.find((e) => e.name === "easeInOut")!.value).toContain("cubic-bezier");
    expect(t.breakpoints).toEqual([
      { name: "xs", min: 0 }, { name: "sm", min: 600 }, { name: "md", min: 900 }, { name: "lg", min: 1200 }, { name: "xl", min: 1536 },
    ]);
  });

  it("falls back to theme.palette when there are no colour schemes", () => {
    const plain = readTokens(createTheme({ palette: { mode: "dark" } }));
    expect(plain.schemes.map((s) => s.mode)).toEqual(["dark"]);
  });
});

describe("resolveColour / contrastPairs", () => {
  it("resolves token paths per mode", () => {
    expect(resolveColour(theme, "light", "palette.primary.main")).toBe("#2f6544");
    expect(resolveColour(theme, "dark", "palette.primary.main")).toBe("#8fd1a8");
    expect(resolveColour(theme, "light", "palette.nope.main")).toBeUndefined();
  });

  it("lists contrastText-on-main and text-on-background pairs for each mode", () => {
    const pairs = contrastPairs(theme);
    expect(pairs).toContainEqual({ mode: "light", label: "warning text on main", fg: "palette.warning.contrastText", bg: "palette.warning.main", kind: "text" });
    expect(pairs).toContainEqual({ mode: "dark", label: "text.primary on background.default", fg: "palette.text.primary", bg: "palette.background.default", kind: "text" });
  });
});
