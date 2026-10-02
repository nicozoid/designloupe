import { Button, Chip, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import { PrimaryButton } from "@/components/PrimaryButton";
import { InfoCard } from "@/components/InfoCard";
import { SparkIcon } from "@/components/icons/SparkIcon";

const Note = styled("div")({ color: "rgb(10, 20, 30)" });

export function Dashboard() {
  return (
    <Stack spacing={2}>
      <InfoCard title="Today" body="3 trips" status="ok" />
      <Chip label="beta" />
      <Button startIcon={<DeleteIcon />}>Remove</Button>
      <PrimaryButton startIcon={<SparkIcon />}>Plan trip</PrimaryButton>
      <Note>Raw MUI usage lives here on purpose.</Note>
    </Stack>
  );
}
