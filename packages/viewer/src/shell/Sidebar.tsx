import { useMemo } from "react";
import { useLoupe } from "../state";
import { href, useRoute } from "../router";
import { groupComponents } from "../groups";

function Item({ to, label, count, disabled, active }: { to: string; label: string; count?: number; disabled?: boolean; active: boolean }) {
  if (disabled) return <li className="dl-nav-item is-disabled" title="Needs a theme">{label}</li>;
  return (
    <li>
      <a className={`dl-nav-item${active ? " is-active" : ""}`} href={to}>
        {label}
        {count !== undefined && <span className="dl-count">{count}</span>}
      </a>
    </li>
  );
}

export function Sidebar() {
  const { model, theme, overrides, docs } = useLoupe();
  const { segments } = useRoute();
  const at = segments.join("/");
  const groups = useMemo(() => groupComponents(model.components, docs), [model.components, docs]);
  const noTheme = !theme;
  const findingsCount = model.findings.length;

  return (
    <nav className="dl-sidebar" aria-label="Design system">
      <div className="dl-brand">
        <span className="dl-brand-mark">◎</span> Design Loupe
        <div className="dl-brand-target">{model.name}</div>
      </div>
      <ul>
        <Item to={href()} label="Overview" active={at === ""} />
      </ul>
      <h2 className="dl-nav-heading">Tokens</h2>
      <ul>
        <Item to={href("tokens", "colour")} label="Colour" active={at === "tokens/colour"} disabled={noTheme} />
        <Item to={href("tokens", "typography")} label="Typography" active={at === "tokens/typography"} disabled={noTheme} />
        <Item to={href("tokens", "layout")} label="Spacing & layout" active={at === "tokens/layout"} disabled={noTheme} />
        <Item to={href("tokens", "elevation")} label="Elevation" active={at === "tokens/elevation"} disabled={noTheme} />
        <Item to={href("tokens", "motion")} label="Motion" active={at === "tokens/motion"} disabled={noTheme} />
        <Item to={href("overrides")} label="Theme overrides" count={overrides.length} active={at === "overrides"} disabled={noTheme} />
      </ul>
      <h2 className="dl-nav-heading">Components</h2>
      <ul>
        {groups.map((g) => (
          <li key={g.key}>
            <a className={`dl-nav-item${segments[0] === "components" && segments[1] === g.key ? " is-active" : ""}`} href={href("components", g.key)}>
              {g.label}
              <span className="dl-count">{g.items.length}</span>
            </a>
            {segments[0] === "components" && segments[1] === g.key && (
              <ul className="dl-nav-children">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <a className={`dl-nav-child${segments[2] === c.name ? " is-active" : ""}`} href={href("components", g.key, c.name)}>{c.name}</a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        <Item to={href("library")} label={`${model.libraryName} used directly`} count={model.libraryUsage.length} active={at === "library"} />
        <Item to={href("icons")} label="Icons" count={model.icons.length} active={at === "icons"} />
      </ul>
      <h2 className="dl-nav-heading">Health</h2>
      <ul>
        <Item to={href("anomalies")} label="Anomalies" count={findingsCount} active={at === "anomalies"} />
      </ul>
    </nav>
  );
}
