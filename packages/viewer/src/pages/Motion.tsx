import { useState } from "react";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { NoTheme } from "./NotFound";

function Mover({ ms, easing }: { ms: number; easing: string }) {
  const [on, setOn] = useState(false);
  return (
    <button type="button" className="dl-mover" onClick={() => setOn((v) => !v)} aria-label="Play">
      <span className="dl-mover-dot" style={{ transform: `translateX(${on ? "10rem" : "0"})`, transition: `transform ${ms}ms ${easing}` }} />
    </button>
  );
}

export function Motion() {
  const { tokens, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  const { durations, easings } = tokens.transitions;
  const standardEase = easings.find((e) => e.name === "easeInOut")?.value ?? "ease";
  const standardMs = durations.find((d) => d.name === "standard")?.ms ?? 300;
  return (
    <>
      <PageHeader title="Motion" lede="Transition durations and easings from the theme. Click a track to play it." source={model.themeEntry} />
      <section className="dl-section">
        <h2>Durations</h2>
        <table className="dl-table"><tbody>
          {durations.map((d) => (
            <tr key={d.name}><td><CopyChip text={`theme.transitions.duration.${d.name}`} /></td><td>{d.name}</td><td>{d.ms}ms</td><td><Mover ms={d.ms} easing={standardEase} /></td></tr>
          ))}
        </tbody></table>
      </section>
      <section className="dl-section">
        <h2>Easings</h2>
        <table className="dl-table"><tbody>
          {easings.map((e) => (
            <tr key={e.name}><td><CopyChip text={`theme.transitions.easing.${e.name}`} /></td><td><code>{e.value}</code></td><td><Mover ms={standardMs} easing={e.value} /></td></tr>
          ))}
        </tbody></table>
      </section>
    </>
  );
}
