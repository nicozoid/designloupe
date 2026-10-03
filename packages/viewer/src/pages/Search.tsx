import { useMemo } from "react";
import { useLoupe } from "../state";
import { href, useRoute } from "../router";
import { groupComponents } from "../groups";
import { PageHeader } from "../ui/PageHeader";
import { componentHref } from "./ComponentSection";

export function Search() {
  const { model, docs, tokens, overrides } = useLoupe();
  const { segments } = useRoute();
  const q = (segments[1] ?? "").toLowerCase();
  const groups = useMemo(() => groupComponents(model.components, docs), [model.components, docs]);
  const has = (...xs: (string | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(q));

  const comps = model.components.filter((c) => has(c.name, c.file, c.description, docs.get(c.id)?.notes));
  const colours = (tokens?.schemes ?? []).flatMap((s) => s.groups.flatMap((g) => g.tokens.filter((t) => has(t.path, t.value)).map((t) => ({ ...t, mode: s.mode, group: g.name }))));
  const type = (tokens?.typography ?? []).filter((v) => has(v.variant));
  const ovs = overrides.filter((o) => has(o.key, o.component));

  return (
    <>
      <PageHeader title={`Search: “${segments[1] ?? ""}”`} lede={`${comps.length + colours.length + type.length + ovs.length} results`} />
      <div className="dl-search-results dl-stack">
        {comps.length > 0 && <section><h2>Components</h2><ul className="dl-list">{comps.map((c) => <li key={c.id}><a href={componentHref(c, groups)}>{c.name}</a> <span className="dl-muted">{c.file}</span></li>)}</ul></section>}
        {colours.length > 0 && <section><h2>Colour tokens</h2><ul className="dl-list">{colours.map((t) => <li key={`${t.mode}-${t.path}`}><a href={`${href("tokens", "colour")}`}>{t.path}</a> <span className="dl-muted">{t.mode} · {t.value}</span></li>)}</ul></section>}
        {type.length > 0 && <section><h2>Typography</h2><ul className="dl-list">{type.map((v) => <li key={v.variant}><a href={href("tokens", "typography")}>{v.variant}</a></li>)}</ul></section>}
        {ovs.length > 0 && <section><h2>Theme overrides</h2><ul className="dl-list">{ovs.map((o) => <li key={o.key}><a href={`${href("overrides")}#${o.key}`}>{o.key}</a></li>)}</ul></section>}
      </div>
    </>
  );
}
