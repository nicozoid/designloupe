import { defineConfig } from "@designloupe/core";

export default defineConfig({
  name: "MUI fixture",
  root: "../mui-fixture",
  themeEntry: "src/theme/index.ts",
  themeExport: "theme",
  componentGlobs: ["src/components/**/*.tsx"],
  usageGlobs: ["src/**/*.{ts,tsx}"],
  tsconfig: "tsconfig.json",
  wrapper: "./Wrapper.tsx",
  presets: ["next"],
  loupeDir: ".",
});
