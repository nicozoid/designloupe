import { useEffect } from "react";
import type { OverrideEntry } from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { Badge } from "../ui/Badge";
import { Preview } from "../ui/Preview";
import { NoTheme } from "./NotFound";

type RawVariant = { props?: unknown };

function BeforeAfter({ component, props }: { component: string; props?: Record<string, unknown> }) {
  const { adapter } = useLoupe();
  const before = adapter.sampleFor(component, props);
  if (!before) return <p className="dl-muted">No sample for {component}; see the code above.</p>;
  const Default = adapter.DefaultThemeFrame;
  return (
    <div className="dl-before-after">
      <div className="dl-before"><div className="dl-ba-label">{adapter.libraryName} default</div><Preview plain><Default>{adapter.sampleFor(component, props)}</Default></Preview></div>
      <div className="dl-after"><div className="dl-ba-label">Your theme</div><Preview>{adapter.sampleFor(component, props)}</Preview></div>
    </div>
  );
}

function Entry({ o, raw }: { o: OverrideEntry; raw: { variants?: RawVariant[] } | undefined }) {
  return (
    <section className="dl-card dl-section" id={o.key}>
      <div className="dl-row">
        <h2 style={{ margin: 0 }}>{o.component}</h2>
        <code className="dl-muted">{o.key}</code>
        {o.defaultProps && <Badge tone="accent">default props</Badge>}
        {o.styleOverrides && <Badge tone="accent">style overrides</Badge>}
        {o.variants && <Badge tone="accent">{o.variants.length} variant{o.variants.length > 1 ? "s" : ""}</Badge>}
      </div>
      {o.defaultProps && (<><h3>Default props</h3><pre className="dl-code">{o.defaultProps}</pre></>)}
      {o.styleOverrides && (<><h3>Style overrides</h3><pre className="dl-code">{o.styleOverrides}</pre></>)}
      <BeforeAfter component={o.component} />
      {o.variants?.map((v, i) => {
        const props = raw?.variants?.[i]?.props;
        const objProps = props && typeof props === "object" ? (props as Record<string, unknown>) : undefined;
        const label = objProps ? Object.entries(objProps).map(([k, x]) => (k === "variant" ? String(x) : `${k}=${String(x)}`)).join(", ") : `#${i + 1}`;
        return (
          <div key={i} className="dl-variant">
            <h3>Variant: {label}</h3>
            <div className="dl-cols">
              <div><div className="dl-ba-label">matches</div><pre className="dl-code">{v.props}</pre></div>
              <div><div className="dl-ba-label">style</div><pre className="dl-code">{v.style}</pre></div>
            </div>
            {objProps && <Preview><VariantSample component={o.component} props={objProps} /></Preview>}
          </div>
        );
      })}
    </section>
  );
}

function VariantSample({ component, props }: { component: string; props: Record<string, unknown> }) {
  const { adapter } = useLoupe();
  return <>{adapter.sampleFor(component, props) ?? <span className="dl-muted">No sample for {component}.</span>}</>;
}

export function Overrides() {
  const { overrides, theme, model } = useLoupe();
  // Deep links look like #/overrides#MuiButton: hash routing can't scroll on its own.
  useEffect(() => {
    const anchor = window.location.hash.split("#")[2];
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }, []);
  if (!theme) return <NoTheme />;
  const raw = ((theme as { components?: Record<string, { variants?: RawVariant[] }> }).components ?? {});
  return (
    <>
      <PageHeader
        title="Theme overrides"
        lede={`Every ${model.libraryName} component the theme customises: default props, style overrides and custom variants, with the library default beside your theme.`}
        source={model.themeEntry}
      />
      {overrides.length === 0 && <p className="dl-muted">The theme doesn't customise any components.</p>}
      {overrides.map((o) => <Entry key={o.key} o={o} raw={raw[o.key]} />)}
    </>
  );
}
