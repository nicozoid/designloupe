import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#2f6544", contrastText: "#f7f4ec" },
        secondary: { main: "#5b4b8a" },
        brand: { main: "#c2410c", light: "#fb923c", dark: "#9a3412", contrastText: "#ffffff" },
        // Planted failure: white on yellow is ~1.6:1.
        warning: { main: "#f5c518", contrastText: "#ffffff" },
        background: { default: "#f2efe6", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#8fd1a8", contrastText: "#10261a" },
        secondary: { main: "#b9a8ee" },
        brand: { main: "#fb923c", light: "#fdba74", dark: "#c2410c", contrastText: "#1c1917" },
        background: { default: "#121412", paper: "#1b1e1b" },
      },
    },
  },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    h1: { fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.02em" },
    eyebrow: { fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
      variants: [
        {
          props: { variant: "dashed" },
          style: ({ theme }) => ({ border: `1px dashed ${theme.palette.primary.main}` }),
        },
      ],
    },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
  },
});
