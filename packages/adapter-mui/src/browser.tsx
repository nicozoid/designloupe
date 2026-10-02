import { useEffect, type ReactNode } from "react";
import { ThemeProvider, createTheme, useColorScheme, type Theme } from "@mui/material/styles";
import ScopedCssBaseline from "@mui/material/ScopedCssBaseline";
import Typography from "@mui/material/Typography";
import type { AdapterBrowser, Mode } from "@designloupe/core";
import { readTokens, resolveColour, contrastPairs } from "./tokens";
import { readOverrides } from "./overrides";
import { sampleFor } from "./samples";

type Obj = Record<string, unknown>;
const defaultTheme = createTheme();

function ModeSync({ mode }: { mode: Mode }) {
  const { setMode } = useColorScheme();
  useEffect(() => {
    setMode?.(mode);
  }, [mode, setMode]);
  return null;
}

function PreviewRoot({ theme, mode, children }: { theme: unknown; mode: Mode; children: ReactNode }) {
  return (
    <ThemeProvider theme={theme as Theme} defaultMode={mode} storageManager={null} disableTransitionOnChange>
      <ModeSync mode={mode} />
      {children}
    </ThemeProvider>
  );
}

function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <ScopedCssBaseline sx={{ bgcolor: "background.default", color: "text.primary", p: 3, borderRadius: 1 }}>
      {children}
    </ScopedCssBaseline>
  );
}

function DefaultThemeFrame({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={defaultTheme}>
      <ScopedCssBaseline sx={{ p: 3, borderRadius: 1 }}>{children}</ScopedCssBaseline>
    </ThemeProvider>
  );
}

function TypographySample({ variant, children }: { variant: string; children: ReactNode }) {
  return <Typography variant={variant as never}>{children}</Typography>;
}

const muiBrowser: AdapterBrowser = {
  id: "mui",
  libraryName: "MUI",
  isTheme: (v) => !!v && typeof v === "object" && "palette" in (v as Obj) && typeof (v as Obj).spacing === "function",
  hasDarkScheme: (t) => !!((t as Obj).colorSchemes as Obj | undefined)?.dark,
  readTokens,
  readOverrides,
  resolveColour,
  contrastPairs,
  PreviewRoot,
  PreviewFrame,
  DefaultThemeFrame,
  TypographySample,
  sampleFor,
};

export default muiBrowser;
