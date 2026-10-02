import { it, expect } from "vitest";
import { rewriteNextFontImports } from "./next-font";

it("rewrites named and default next/font imports to a stub", () => {
  const code = `import { Inter, Roboto_Mono as Mono } from "next/font/google";\nimport localFont from 'next/font/local';\nconst a = 1;`;
  const out = rewriteNextFontImports(code)!;
  expect(out).toContain(`import { loupeFont as __loupeFont } from "virtual:loupe/next-font";`);
  expect(out).toContain("const Inter = __loupeFont;");
  expect(out).toContain("const Mono = __loupeFont;");
  expect(out).toContain("const localFont = __loupeFont;");
  expect(out).not.toContain("next/font");
  expect(rewriteNextFontImports("const x = 1;")).toBeNull();
});
