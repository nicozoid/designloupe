import { defineComponentDoc } from "@designloupe/core";
import { Stack } from "@mui/material";
import { PrimaryButton } from "@target/src/components/PrimaryButton";

export default defineComponentDoc({
  component: "src/components/PrimaryButton.tsx",
  tier: "atom",
  notes: "Use for the single main action on a page. Tone `brand` is for upsell only.",
  demo: () => (
    <Stack direction="row" spacing={2}>
      <PrimaryButton>Save</PrimaryButton>
      <PrimaryButton tone="brand">Upgrade</PrimaryButton>
      <PrimaryButton disabled>Disabled</PrimaryButton>
    </Stack>
  ),
  a11y: {
    pattern: "button",
    role: "button",
    name: "Text content",
    keyboard: [{ keys: "Enter / Space", does: "Activates the button" }],
    checks: [
      { sc: "2.1.1", status: "inherited", evidence: "MUI ButtonBase renders a native <button>." },
      { sc: "1.4.3", measure: { fg: "palette.primary.contrastText", bg: "palette.primary.main", kind: "text", label: "label on fill" } },
      { sc: "1.4.3", measure: { fg: "palette.brand.contrastText", bg: "palette.brand.main", kind: "text", label: "brand label on fill" } },
    ],
  },
});
