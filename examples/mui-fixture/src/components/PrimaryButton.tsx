import Button, { type ButtonProps } from "@mui/material/Button";

export interface PrimaryButtonProps extends ButtonProps {
  /** Brand uses the brand palette; neutral uses primary. */
  tone?: "brand" | "neutral";
}

/** The main call-to-action button. */
export function PrimaryButton({ tone = "neutral", ...rest }: PrimaryButtonProps) {
  return <Button variant="contained" color={tone === "brand" ? "brand" as never : "primary"} {...rest} />;
}
