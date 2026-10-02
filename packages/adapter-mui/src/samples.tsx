import type { ReactNode } from "react";
import {
  Alert, Avatar, Badge, Button, Card, CardContent, Checkbox, Chip, LinearProgress, Paper, Slider, Stack,
  Switch, Tab, Tabs, TextField, Typography, IconButton, Link, Divider, Tooltip,
} from "@mui/material";

type P = Record<string, unknown>;
const SAMPLES: Record<string, (p: P) => ReactNode> = {
  Button: (p) => (
    <Stack direction="row" spacing={1}>
      {p.variant ? <Button {...p}>Button</Button> : (<><Button variant="text">Text</Button><Button variant="outlined">Outlined</Button><Button variant="contained">Contained</Button></>)}
    </Stack>
  ),
  TextField: (p) => <TextField label="Label" helperText="Helper text" {...p} />,
  Card: (p) => <Card {...p}><CardContent><Typography variant="h6">Card title</Typography><Typography variant="body2">Card body text.</Typography></CardContent></Card>,
  Paper: (p) => <Paper sx={{ p: 2 }} {...p}>Paper</Paper>,
  Chip: (p) => <Stack direction="row" spacing={1}><Chip label="Chip" {...p} /><Chip label="Outlined" variant="outlined" {...p} /></Stack>,
  Alert: (p) => <Alert severity="info" {...p}>An informational alert.</Alert>,
  Switch: (p) => <Switch defaultChecked {...p} />,
  Checkbox: (p) => <Checkbox defaultChecked {...p} />,
  Tabs: (p) => <Tabs value={0} {...p}><Tab label="One" /><Tab label="Two" /></Tabs>,
  Avatar: (p) => <Avatar {...p}>DL</Avatar>,
  Badge: (p) => <Badge badgeContent={4} color="primary" {...p}><Avatar>DL</Avatar></Badge>,
  LinearProgress: (p) => <LinearProgress variant="determinate" value={60} {...p} />,
  Slider: (p) => <Slider defaultValue={40} sx={{ width: 200 }} {...p} />,
  IconButton: (p) => <IconButton aria-label="sample" {...p}>★</IconButton>,
  Link: (p) => <Link href="#" {...p}>A link</Link>,
  Divider: (p) => <Divider {...p} />,
  Tooltip: (p) => <Tooltip title="Tooltip" open {...p}><span>Hover target</span></Tooltip>,
  Typography: (p) => <Typography {...p}>Typography</Typography>,
};

export function sampleFor(component: string, props: P = {}): ReactNode | null {
  const make = SAMPLES[component];
  return make ? make(props) : null;
}
