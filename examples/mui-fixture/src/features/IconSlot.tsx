import type { SvgIconComponent } from "@mui/icons-material";

/** A type-only icon import: it never renders, so it must not show up as an icon. */
export interface IconSlot {
  icon: SvgIconComponent;
  label: string;
}
