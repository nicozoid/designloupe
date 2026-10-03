import { useEffect, useState, type ComponentType } from "react";
import icons from "virtual:loupe/icons";
import components from "virtual:loupe/components";
import type { IconInfo } from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { Preview } from "../ui/Preview";
import { ErrorCard } from "../ui/ErrorCard";

function useIcon(i: IconInfo): ComponentType<Record<string, unknown>> | Error | null {
  const { model } = useLoupe();
  const [C, setC] = useState<ComponentType<Record<string, unknown>> | Error | null>(null);
  useEffect(() => {
    const load =
      i.source === "library"
        ? icons[i.name]?.().then((m) => m.default)
        : components[i.componentId!]?.().then((m) => m[model.components.find((c) => c.id === i.componentId)!.exportName] as ComponentType<Record<string, unknown>>);
    load?.then((c) => setC(() => c)).catch((e: Error) => setC(e));
  }, [i, model.components]);
  return C;
}

function importLine(i: IconInfo) {
  if (i.source === "custom") return `import { ${i.name} } from "${i.importPath.replace(/\.(tsx?|jsx?)$/, "")}";`;
  const path = i.importPath.endsWith(`/${i.name}`) ? i.importPath : `${i.importPath}/${i.name}`;
  return `import ${i.name}Icon from "${path}";`;
}

function IconTile({ i }: { i: IconInfo }) {
  const C = useIcon(i);
  return (
    <div className="dl-icon-tile dl-card">
      <Preview>{C instanceof Error ? null : C ? <C fontSize="large" /> : null}</Preview>
      {C instanceof Error && <ErrorCard title="Icon failed to load" message={C.message} />}
      <strong>{i.name}</strong>
      <span className="dl-muted">{i.source === "library" ? "library" : "custom"} · {i.sites.length} use{i.sites.length === 1 ? "" : "s"}</span>
      <CopyChip text={importLine(i)} />
    </div>
  );
}

export function Icons() {
  const { model } = useLoupe();
  return (
    <>
      <PageHeader title="Icons" lede="Library icons imported anywhere in the app, and custom icon components (names ending in Icon, or built on SvgIcon)." />
      <div className="dl-grid">{model.icons.map((i) => <IconTile key={`${i.source}:${i.name}:${i.importPath}`} i={i} />)}</div>
    </>
  );
}
