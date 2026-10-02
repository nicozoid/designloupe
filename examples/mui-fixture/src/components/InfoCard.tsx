import { Card, CardContent, Typography } from "@mui/material";
import { StatusPill } from "./StatusPill";

export interface InfoCardProps {
  title: string;
  body?: string;
  status?: "ok" | "warn" | "error";
}

/** Summary card with an optional status pill. */
export function InfoCard({ title, body, status }: InfoCardProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        {body && <Typography variant="body2">{body}</Typography>}
        {status && <StatusPill status={status} label={status} />}
      </CardContent>
    </Card>
  );
}
