import type { AdapterNode } from "@designloupe/core";

const PKG = /^@mui\/(?:material|lab|x-[a-z-]+)(?:\/([A-Z][A-Za-z0-9]*))?$/;
const ICONS = /^@mui\/icons-material(?:\/([A-Za-z0-9]+))?$/;
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const NOT_COMPONENT = /(Props|Classes|ClassKey|Theme|Options|Context|Slots|SlotProps)$/;
// App infrastructure, not design-system components (main.tsx renders CssBaseline; it must not count as raw usage).
const PROVIDERS = new Set(["ThemeProvider", "StyledEngineProvider", "CssVarsProvider", "CssBaseline", "ScopedCssBaseline", "GlobalStyles"]);

const isComponentName = (n: string) => COMPONENT_NAME.test(n) && !NOT_COMPONENT.test(n) && !PROVIDERS.has(n);

const muiNode: AdapterNode = {
  id: "mui",
  libraryName: "MUI",
  packageName: "@mui/material",
  layoutPrimitives: ["Box", "Stack", "Grid", "Grid2", "Container", "Typography", "Divider"],
  classifyImport(specifier, imported) {
    const m = PKG.exec(specifier);
    if (!m) return null;
    if (m[1]) return imported === "default" ? m[1] : isComponentName(imported) ? imported : null;
    return isComponentName(imported) ? imported : null;
  },
  classifyIconImport(specifier, imported) {
    const m = ICONS.exec(specifier);
    if (!m) return null;
    if (m[1]) return imported === "default" ? m[1] : null;
    return COMPONENT_NAME.test(imported) ? imported : null;
  },
};

export default muiNode;
