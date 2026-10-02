import { describe, it, expect } from "vitest";
import path from "node:path";
import { createAnalysis } from "./program";

const root = path.resolve(import.meta.dirname, "../../../../examples/mui-fixture");

describe("createAnalysis", () => {
  const a = createAnalysis(root, path.join(root, "tsconfig.json"));

  it("resolves tsconfig path aliases and relative imports to source files", () => {
    const from = path.join(root, "src/features/Settings.tsx");
    expect(a.resolve("@/components/PrimaryButton", from)).toBe(path.join(root, "src/components/PrimaryButton.tsx"));
    expect(a.resolve("./Settings", path.join(root, "src/features/Dashboard.tsx"))).toBe(from);
  });

  it("does not resolve packages into node_modules", () => {
    expect(a.resolve("@mui/material", path.join(root, "src/App.tsx"))).toBeUndefined();
  });

  it("extracts props with docgen", () => {
    const docs = a.parseProps([path.join(root, "src/components/TextInput.tsx")]);
    const doc = docs.find((d) => d.displayName === "TextInput")!;
    expect(doc.description).toContain("Single-line text input");
    expect(doc.props.label!.required).toBe(true);
    expect(doc.props.type!.type.name).toBe("enum");
  });
});
