import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/** Placeholder for empty lists. Needs i18n context. */
export function EmptyState() {
  const { t } = useTranslation();
  return (
    <Stack spacing={1} sx={{ alignItems: "center" }}>
      <Typography variant="h6">{t("empty.title")}</Typography>
      <Typography variant="body2">{t("empty.body")}</Typography>
    </Stack>
  );
}
