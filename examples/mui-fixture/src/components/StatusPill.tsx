import { Box } from "@mui/material";

export interface StatusPillProps {
  status: "ok" | "warn" | "error";
  label: string;
}

/** Small status indicator. */
export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <Box
      component="span"
      // Planted anomalies: hard-coded colour and px spacing.
      sx={{ bgcolor: "#e8f5e9", px: "6px", borderRadius: 1, fontSize: 12, opacity: status === "error" ? 0.6 : 1 }}
    >
      {label}
    </Box>
  );
}
