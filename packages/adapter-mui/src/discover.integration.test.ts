import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { loadConfig, discover } from "@designloupe/core/node";
import type { DiscoveryModel } from "@designloupe/core";
import muiNode from "./node";

const configPath = path.resolve(import.meta.dirname, "../../../examples/fixture-loupe/loupe.config.ts");
let model: DiscoveryModel;

beforeAll(async () => {
  model = await discover(await loadConfig(configPath), muiNode);
}, 120_000);

const byName = (n: string) => model.components.find((c) => c.name === n)!;

describe("discover(fixture)", () => {
  it("finds the nine components with the right wrap/custom split", () => {
    expect(model.components.map((c) => c.name).sort()).toEqual(
      ["Broken", "DocsLink", "EmptyState", "InfoCard", "NavLinkButton", "PrimaryButton", "SparkIcon", "StatusPill", "TextInput"],
    );
    expect(byName("PrimaryButton").source).toEqual({ kind: "wraps", library: "MUI", component: "Button" });
    expect(byName("TextInput").source).toEqual({ kind: "wraps", library: "MUI", component: "TextField" });
    expect(byName("InfoCard").source).toEqual({ kind: "wraps", library: "MUI", component: "Card" });
    expect(byName("SparkIcon").source).toEqual({ kind: "wraps", library: "MUI", component: "SvgIcon" });
    expect(byName("StatusPill").source).toEqual({ kind: "custom" });
    expect(byName("EmptyState").source).toEqual({ kind: "custom" });
  });

  it("records ids, folders, props and descriptions", () => {
    const pb = byName("PrimaryButton");
    expect(pb.id).toBe("src/components/PrimaryButton.tsx#PrimaryButton");
    expect(pb.folder).toBe("src/components");
    expect(pb.description).toBe("The main call-to-action button.");
    expect(pb.props[0]).toMatchObject({ name: "tone", enumValues: ["brand", "neutral"], inherited: false });
    expect(pb.inheritedPropCount).toBeGreaterThan(20);
    expect(byName("SparkIcon").folder).toBe("src/components/icons");
  });

  it("computes built-from (library + own) and usages", () => {
    const card = byName("InfoCard");
    expect(card.builtFrom.library).toEqual(["Card", "CardContent", "Typography"]);
    expect(card.builtFrom.own).toEqual(["src/components/StatusPill.tsx#StatusPill"]);
    const sites = byName("PrimaryButton").usages.map((u) => u.file).sort();
    expect(sites).toEqual(["src/features/Dashboard.tsx", "src/features/Settings.tsx", "src/features/Settings.tsx"]);
    expect(byName("StatusPill").usages).toEqual([{ file: "src/components/InfoCard.tsx", line: 17 }]);
  });

  it("collects raw library usage outside component globs", () => {
    const names = model.libraryUsage.map((u) => u.component).sort();
    expect(names).toEqual(["Button", "Chip", "Stack"]);
    expect(model.libraryUsage.every((u) => u.sites.every((s) => s.file === "src/features/Dashboard.tsx"))).toBe(true);
  });

  it("collects library and custom icons", () => {
    const icons = model.icons.map((i) => `${i.source}:${i.name}`).sort();
    expect(icons).toEqual(["custom:SparkIcon", "library:Delete"]);
    expect(model.icons.find((i) => i.name === "Delete")!.sites).toHaveLength(1);
    expect(byName("SparkIcon").isIcon).toBe(true);
  });

  it("follows a barrel inside componentGlobs instead of counting it as a second component", () => {
    // src/components/icons/index.tsx re-exports SparkIcon; Dashboard imports it from "@/components/icons".
    expect(model.components.filter((c) => c.name === "SparkIcon").map((c) => c.id)).toEqual(["src/components/icons/SparkIcon.tsx#SparkIcon"]);
    expect(byName("SparkIcon").usages.map((u) => u.file)).toEqual(["src/features/Dashboard.tsx"]);
  });

  it("collects the planted static findings", () => {
    const f = model.findings.map((x) => `${x.file}|${x.rule}|${x.snippet}`).sort();
    expect(f).toEqual([
      "src/components/StatusPill.tsx|colour-literal|bgcolor: #e8f5e9",
      "src/components/StatusPill.tsx|px-spacing|px: 6px",
      "src/features/Dashboard.tsx|colour-literal|color: rgb(10, 20, 30)",
    ]);
  });

  it("reads library metadata", () => {
    expect(model.libraryName).toBe("MUI");
    expect(model.libraryVersion).toMatch(/^9\./);
    expect(model.themeExport).toBe("theme");
    expect(model.warnings).toEqual([]);
  });
});
