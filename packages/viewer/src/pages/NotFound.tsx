import { PageHeader } from "../ui/PageHeader";

export function NotFound() {
  return <PageHeader title="Not found" lede="That page doesn't exist. Pick one from the sidebar." />;
}

export function NoTheme() {
  return <PageHeader title="No theme" lede="Token pages need a theme. Set themeEntry and themeExport in loupe.config.ts, then check the Overview for load errors." />;
}
