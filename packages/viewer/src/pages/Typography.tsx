import { useLayoutEffect, useRef, useState } from "react";
import type { TypographyToken } from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { Panel } from "../ui/Panel";
import { Preview } from "../ui/Preview";
import { NoTheme } from "./NotFound";

const SAMPLE = "Sphinx of black quartz, judge my vow";
const METRICS = [["font-family", "fontFamily"], ["font-size", "fontSize"], ["font-weight", "fontWeight"], ["line-height", "lineHeight"], ["letter-spacing", "letterSpacing"]] as const;

function Specimen({ v }: { v: TypographyToken }) {
  const { adapter, mode } = useLoupe();
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Record<string, string>>({});
  useLayoutEffect(() => {
    // .dl-stage > PreviewFrame root > the Typography element
    const el = ref.current?.querySelector(".dl-stage")?.firstElementChild?.firstElementChild;
    if (!el) return;
    const cs = getComputedStyle(el);
    setM(Object.fromEntries(METRICS.map(([label, key]) => [label, cs[key]])));
  }, [mode]);
  const Sample = adapter.TypographySample;
  return (
    <div className="dl-card" id={v.variant}>
      <div className="dl-row">
        <strong>{v.variant}</strong>
        <CopyChip text={`<Typography variant="${v.variant}">`} />
      </div>
      <div ref={ref}>
        <Preview><Sample variant={v.variant}>{SAMPLE}</Sample></Preview>
      </div>
      <dl className="dl-metrics">
        {Object.entries(m).map(([k, val]) => (
          <div key={k}><dt>{k}</dt><dd>{val.replace(/__[A-Za-z0-9_]+/g, "")}</dd></div>
        ))}
      </dl>
      {v.responsive.length > 0 && (
        <Panel title="Responsive sizes" count={v.responsive.length}>
          {v.responsive.map((r) => (
            <div key={r.query} className="dl-row"><code>{r.query}</code><span className="dl-muted">{Object.entries(r.style).map(([k, x]) => `${k}: ${x}`).join("; ")}</span></div>
          ))}
        </Panel>
      )}
    </div>
  );
}

export function TypographyPage() {
  const { tokens, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  return (
    <>
      <PageHeader title="Typography" lede="Every typography variant in the theme, rendered with the target's Typography component. Metrics are measured from the rendered text." source={model.themeEntry} />
      <div className="dl-stack">{tokens.typography.map((v) => <Specimen key={v.variant} v={v} />)}</div>
    </>
  );
}
