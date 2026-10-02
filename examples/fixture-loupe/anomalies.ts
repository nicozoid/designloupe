import { defineAnomalies } from "@designloupe/core";

export default defineAnomalies([
  {
    id: "h001",
    title: "Two near-identical greens",
    category: "color",
    status: "todo",
    description: "primary.main and the StatusPill background are both greens with no shared token.",
    locations: ["src/theme/index.ts", "src/components/StatusPill.tsx"],
    fix: "Add palette.success usage to StatusPill.",
  },
]);
