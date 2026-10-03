export default {
  name: "Bad theme",
  root: "../../../examples/mui-fixture",
  themeEntry: "src/theme/index.ts",
  themeExport: "nope",
  componentGlobs: ["src/components/**/*.tsx"],
  presets: ["next"],
};
