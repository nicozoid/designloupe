import { useEffect, useMemo } from "react";
import { useLoupe } from "../state";
import { href, useRoute } from "../router";
import { groupComponents } from "../groups";
import { PageHeader } from "../ui/PageHeader";
import { ComponentSection } from "./ComponentSection";
import { NotFound } from "./NotFound";

export function Components() {
  const { model, docs } = useLoupe();
  const { segments } = useRoute();
  const groups = useMemo(() => groupComponents(model.components, docs), [model.components, docs]);
  const [, groupKey, name] = segments;

  useEffect(() => {
    if (name) document.getElementById(`c-${name}`)?.scrollIntoView();
  }, [groupKey, name]);

  if (!groupKey) {
    return (
      <>
        <PageHeader title="Components" lede={`${model.components.length} components discovered. Grouped by tier where loupe files assign one, otherwise by folder.`} />
        <section className="dl-tiles">
          {groups.map((g) => (
            <a key={g.key} className="dl-tile" href={href("components", g.key)}>
              <div className="dl-tile-value">{g.items.length}</div>
              <div className="dl-tile-label">{g.label}</div>
              <div className="dl-tile-detail">{g.items.slice(0, 6).map((c) => c.name).join(", ")}{g.items.length > 6 ? "…" : ""}</div>
            </a>
          ))}
        </section>
      </>
    );
  }
  const group = groups.find((g) => g.key === groupKey);
  if (!group) return <NotFound />;
  return (
    <>
      <PageHeader title={group.label} lede={`${group.items.length} component${group.items.length === 1 ? "" : "s"}`} />
      <div className="dl-stack">{group.items.map((c) => <ComponentSection key={c.id} c={c} groups={groups} />)}</div>
    </>
  );
}
