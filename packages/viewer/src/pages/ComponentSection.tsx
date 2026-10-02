import type { ComponentInfo } from "@designloupe/core";
import { useLoupe } from "../state";
import { href } from "../router";
import { Badge } from "../ui/Badge";
import { CopyChip } from "../ui/CopyChip";
import { Panel } from "../ui/Panel";
import { Demo } from "./Demo";
import { A11yPanel } from "./A11yPanel";
import type { ComponentGroup } from "../groups";

export function componentHref(c: ComponentInfo, groups: ComponentGroup[]): string {
  const g = groups.find((x) => x.items.some((i) => i.id === c.id));
  return g ? href("components", g.key, c.name) : href("components");
}

export function ComponentSection({ c, groups }: { c: ComponentInfo; groups: ComponentGroup[] }) {
  const { model, docs, overrides, failures } = useLoupe();
  const doc = docs.get(c.id);
  const byId = new Map(model.components.map((x) => [x.id, x]));
  const own = c.props.filter((p) => !p.inherited);
  const inh = c.props.filter((p) => p.inherited);
  const override = c.source.kind === "wraps" ? overrides.find((o) => o.component === (c.source as { component: string }).component) : undefined;
  return (
    <section className="dl-component dl-card" id={`c-${c.name}`}>
      <header className="dl-row">
        <h2 style={{ margin: 0 }}>{c.name}</h2>
        {c.source.kind === "wraps" ? <Badge tone="accent">wraps {c.source.library} {c.source.component}</Badge> : <Badge>custom</Badge>}
        {doc?.tier && <Badge>{doc.tier}</Badge>}
        {failures[c.id] && <Badge tone="bad">failed</Badge>}
        <CopyChip text={c.file} />
        <span className="dl-muted">{c.usages.length} use{c.usages.length === 1 ? "" : "s"}</span>
      </header>
      {c.description && <p>{c.description}</p>}
      {doc?.notes && <p className="dl-notes">{doc.notes}</p>}
      <Demo c={c} />
      <Panel title="Props" count={own.length}>
        <table className="dl-table">
          <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
          <tbody>
            {[...own, ...inh].map((p) => (
              <tr key={p.name}>
                <td><code>{p.name}</code>{p.required && <span className="dl-required" title="required">*</span>}{p.inherited && <div className="dl-muted">inherited</div>}</td>
                <td><code>{p.type}</code></td>
                <td>{p.defaultValue !== undefined ? <code>{p.defaultValue}</code> : "—"}</td>
                <td>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {c.inheritedPropCount > 0 && (
          <p className="dl-muted">
            + {c.inheritedPropCount} props inherited{c.source.kind === "wraps" ? ` from ${c.source.library} ${c.source.component}` : ""} (only common ones listed).
          </p>
        )}
      </Panel>
      <Panel title="Built from" count={c.builtFrom.library.length + c.builtFrom.own.length}>
        <div className="dl-row">
          {c.builtFrom.own.map((id) => {
            const o = byId.get(id);
            return o ? <a key={id} className="dl-chip" href={componentHref(o, groups)}>{o.name}</a> : null;
          })}
          {c.builtFrom.library.map((l) => <span key={l} className="dl-chip">{model.libraryName} {l}</span>)}
        </div>
      </Panel>
      <Panel title="Used in" count={c.usages.length}>
        {c.usages.length === 0 ? <p className="dl-muted">Registered but unused.</p> : (
          <ul className="dl-list">{c.usages.map((u, i) => <li key={i}><CopyChip text={`${u.file}:${u.line}`} /></li>)}</ul>
        )}
      </Panel>
      {override && (
        <Panel title="Theme overrides that apply">
          <p>
            The theme customises {model.libraryName} {override.component}:{" "}
            {[override.defaultProps && "default props", override.styleOverrides && "style overrides", override.variants && `${override.variants.length} variant(s)`].filter(Boolean).join(", ")}.{" "}
            <a href={`${href("overrides")}#${override.key}`}>See overrides</a>
          </p>
        </Panel>
      )}
      {doc?.a11y && <A11yPanel a11y={doc.a11y} />}
    </section>
  );
}
