import { it, expect } from "vitest";
import type { ComponentDoc } from "react-docgen-typescript";
import { toPropInfo } from "./props";

const nm = { fileName: "/x/node_modules/@mui/material/Button/Button.d.ts", name: "ButtonOwnProps" };
const own = { fileName: "/x/src/PrimaryButton.tsx", name: "PrimaryButtonProps" };

const doc = {
  displayName: "PrimaryButton",
  description: "",
  filePath: "/x/src/PrimaryButton.tsx",
  methods: [],
  tags: {},
  props: {
    tone: { name: "tone", required: false, description: "Tone.", defaultValue: { value: "neutral" }, parent: own, declarations: [own],
      type: { name: "enum", raw: '"brand" | "neutral"', value: [{ value: '"brand"' }, { value: '"neutral"' }] } },
    variant: { name: "variant", required: false, description: "", defaultValue: null, parent: nm, declarations: [nm],
      type: { name: "enum", raw: "OverridableStringUnion<…>", value: [{ value: '"text"' }, { value: '"outlined"' }, { value: "string & {}" }] } },
    onFocusVisible: { name: "onFocusVisible", required: false, description: "", defaultValue: null, parent: nm, declarations: [nm], type: { name: "FocusEventHandler" } },
    disabled: { name: "disabled", required: false, description: "", defaultValue: null, parent: nm, declarations: [nm],
      type: { name: "enum", raw: "boolean", value: [{ value: "false" }, { value: "true" }] } },
  },
} as unknown as ComponentDoc;

it("splits own vs inherited, keeps only useful inherited props, unquotes enum literals", () => {
  const { props, inheritedPropCount } = toPropInfo(doc);
  expect(inheritedPropCount).toBe(3);
  expect(props.map((p) => p.name)).toEqual(["tone", "disabled", "variant"]);
  expect(props[0]).toEqual({ name: "tone", type: '"brand" | "neutral"', required: false, defaultValue: "neutral", description: "Tone.", enumValues: ["brand", "neutral"], inherited: false });
  expect(props[1]).toMatchObject({ name: "disabled", type: "boolean", enumValues: ["false", "true"], inherited: true });
  expect(props[2]).toMatchObject({ name: "variant", enumValues: ["text", "outlined"], inherited: true });
});
