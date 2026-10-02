import { useLoupe } from "../state";
import { href } from "../router";
import { PageHeader } from "../ui/PageHeader";
import { ErrorCard } from "../ui/ErrorCard";

function Tile({ label, value, to, detail }: { label: string; value: number | string; to?: string; detail?: string }) {
  const body = (
    <>
      <div className="dl-tile-value">{value}</div>
      <div className="dl-tile-label">{label}</div>
      {detail && <div className="dl-tile-detail">{detail}</div>}
    </>
  );
  return to ? <a className="dl-tile" href={to}>{body}</a> : <div className="dl-tile">{body}</div>;
}

export function Overview() {
  const { model, overrides, themeError, wrapperError, docErrors, failures, docs } = useLoupe();
  const wraps = model.components.filter((c) => c.source.kind === "wraps").length;
  const rawSites = model.libraryUsage.reduce((n, u) => n + u.sites.length, 0);
  const failureCount = Object.keys(failures).length;
  return (
    <>
      <PageHeader
        title={model.name}
        lede={<>{model.libraryName} {model.libraryVersion ?? "(version unknown)"} · {model.components.length} components discovered · scanned {new Date(model.generatedAt).toLocaleTimeString()}</>}
        source={model.themeEntry ? `${model.themeEntry} → ${model.themeExport}` : undefined}
      />
      <section className="dl-tiles">
        <Tile label="Components" value={model.components.length} to={href("components")} detail={`${wraps} wrap ${model.libraryName} · ${model.components.length - wraps} custom`} />
        <Tile label="Theme overrides" value={overrides.length} to={href("overrides")} />
        <Tile label={`${model.libraryName} used directly`} value={rawSites} to={href("library")} detail={`${model.libraryUsage.length} components`} />
        <Tile label="Icons" value={model.icons.length} to={href("icons")} />
        <Tile label="Static findings" value={model.findings.length} to={href("anomalies")} />
        <Tile label="Loupe docs" value={docs.size} detail="components with hand-written docs" />
      </section>
      <section className="dl-stack">
        {themeError && <ErrorCard title="Theme failed to load: token pages are disabled" message={themeError} />}
        {wrapperError && <ErrorCard title="Wrapper failed to load: previews render without it" message={wrapperError} />}
        {docErrors.map((m) => <ErrorCard key={m} title="Loupe file problem" message={m} />)}
        {model.warnings.map((w) => <ErrorCard key={w} title="Discovery warning" message={w} />)}
        {failureCount > 0 && <ErrorCard title={`${failureCount} component(s) failed in this session`} message={Object.entries(failures).map(([id, m]) => `${id}: ${m}`).join("\n")} />}
      </section>
    </>
  );
}
