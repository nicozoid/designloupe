import { it, expect } from "vitest";
import { anomalyCode, fnv1a } from "./codes";

it("fnv1a is the 32-bit FNV-1a hash", () => {
  expect(fnv1a("")).toBe(0x811c9dc5);
  expect(fnv1a("a")).toBe(0xe40c292c);
});

it("anomalyCode is 4 base36 chars, deterministic and input-sensitive", () => {
  const a = anomalyCode("colour-literal", "src/x.tsx", "bgcolor: #e8f5e9");
  expect(a).toMatch(/^[0-9a-z]{4}$/);
  expect(anomalyCode("colour-literal", "src/x.tsx", "bgcolor: #e8f5e9")).toBe(a);
  expect(anomalyCode("colour-literal", "src/y.tsx", "bgcolor: #e8f5e9")).not.toBe(a);
});
