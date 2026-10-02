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
