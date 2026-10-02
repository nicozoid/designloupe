import { defineConfig } from "@designloupe/core";

export default defineConfig({
  name: "Fixture",
  root: "./target",
  themeEntry: "src/theme.ts",
  componentGlobs: ["src/**/*.tsx"],
  wrapper: "./Wrapper.tsx",
  shims: { "next/link": "./shim.tsx", "some-pkg": "other-pkg" },
});
