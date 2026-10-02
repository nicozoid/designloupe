import type { CSSProperties } from "react";
import "@mui/material/styles";
import "@mui/material/Button";

declare module "@mui/material/styles" {
  interface Palette { brand: Palette["primary"] }
  interface PaletteOptions { brand?: PaletteOptions["primary"] }
  interface TypographyVariants { eyebrow: CSSProperties }
  interface TypographyVariantsOptions { eyebrow?: CSSProperties }
}
declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides { eyebrow: true }
}
declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides { dashed: true }
}
