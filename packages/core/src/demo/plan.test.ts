import { it, expect } from "vitest";
import { planAutoDemo } from "./plan";
import type { PropInfo } from "../model";

const p = (o: Partial<PropInfo> & { name: string }): PropInfo => ({ type: "string", required: false, inherited: false, ...o });

it("expands up to two enum props into axes (own first, then inherited variant/size/color)", () => {
  const plan = planAutoDemo({
    name: "PrimaryButton",
    props: [
      p({ name: "tone", type: "enum", enumValues: ["brand", "neutral"] }),
      p({ name: "children", type: "ReactNode", inherited: true }),
      p({ name: "size", type: "enum", enumValues: ["small", "medium", "large"], inherited: true }),
      p({ name: "variant", type: "enum", enumValues: ["text", "outlined", "contained", "dashed"], inherited: true }),
      p({ name: "disabled", type: "enum", enumValues: ["false", "true"] }),
    ],
  });
  expect(plan).toEqual({
    kind: "grid",
    base: { children: "PrimaryButton" },
    axes: [
      { prop: "tone", values: ["brand", "neutral"] },
      { prop: "variant", values: ["text", "outlined", "contained", "dashed"] },
    ],
  });
});

it("fills required props it can and reports the ones it can't", () => {
  expect(
    planAutoDemo({
      name: "TextInput",
      props: [p({ name: "label", required: true }), p({ name: "count", type: "number", required: true }), p({ name: "onSave", type: "() => void", required: true })],
    }),
  ).toMatchObject({ kind: "grid", base: { label: "TextInput", count: 1 } });

  expect(
    planAutoDemo({ name: "Chart", props: [p({ name: "data", type: "Point[]", required: true }), p({ name: "title", required: true })] }),
  ).toEqual({ kind: "needs-demo", missing: ["data"] });
});

it("required enums take their first value; required booleans are false", () => {
  const plan = planAutoDemo({
    name: "StatusPill",
    props: [p({ name: "status", type: "enum", required: true, enumValues: ["ok", "warn", "error"] }), p({ name: "label", required: true }), p({ name: "dense", type: "boolean", required: true })],
  });
  expect(plan).toEqual({
    kind: "grid",
    base: { status: "ok", label: "StatusPill", dense: false },
    axes: [{ prop: "status", values: ["ok", "warn", "error"] }],
  });
});
