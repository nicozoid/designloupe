import { it, expect } from "vitest";
import { serialise } from "./serialise";

it("pretty-prints objects, arrays, quoted keys and functions as source", () => {
  const out = serialise({ root: { textTransform: "none", "&:hover": { opacity: 0.8 } }, list: [1, "a"], fn: (x: number) => x + 1, none: undefined });
  expect(out).toBe(
    [
      "{",
      "  root: {",
      '    textTransform: "none",',
      '    "&:hover": {',
      "      opacity: 0.8",
      "    }",
      "  },",
      "  list: [",
      "    1,",
      '    "a"',
      "  ],",
      "  fn: (x) => x + 1,",
      "  none: undefined",
      "}",
    ].join("\n"),
  );
  expect(serialise({})).toBe("{}");
  expect(serialise([])).toBe("[]");
});

it("prints a cycle as [Circular] instead of overflowing the stack", () => {
  const a: Record<string, unknown> = { x: 1 };
  a.self = a;
  const shared = { k: 1 };
  expect(serialise(a)).toBe("{\n  x: 1,\n  self: [Circular]\n}");
  // The same object twice, side by side, is not a cycle.
  expect(serialise([shared, shared])).toBe("[\n  {\n    k: 1\n  },\n  {\n    k: 1\n  }\n]");
});
