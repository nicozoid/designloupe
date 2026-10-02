import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { NoTheme } from "./NotFound";

function SpacingRow({ factor, value }: { factor: number; value: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState("");
  useLayoutEffect(() => {
    if (ref.current) setPx(`${Math.round(ref.current.getBoundingClientRect().width * 100) / 100}px`);
  }, [value]);
  return (
    <tr className="dl-spacing-row">
      <td><CopyChip text={`theme.spacing(${factor})`} /></td>
      <td className="dl-muted">{value}</td>
      <td>{px}</td>
      <td><div ref={ref} className="dl-spacing-bar" style={{ width: value }} /></td>
    </tr>
  );
}

function Breakpoints({ bps }: { bps: { name: string; min: number }[] }) {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const max = Math.max(1, ...bps.map((b) => b.min)) * 1.25;
  const current = [...bps].reverse().find((b) => w >= b.min)?.name;
  return (
    <div className="dl-bp" aria-label={`Viewport ${w}px`}>
      {bps.map((b, i) => (
        <div
          key={b.name}
          className={`dl-bp-seg${b.name === current ? " is-current" : ""}`}
          style={{ left: `${(b.min / max) * 100}%`, width: `${(((bps[i + 1]?.min ?? max) - b.min) / max) * 100}%` }}
        >
          <strong>{b.name}</strong> <span className="dl-muted">≥{b.min}px</span>
        </div>
      ))}
      <div className="dl-bp-marker" style={{ left: `${(Math.min(w, max) / max) * 100}%` }} title={`You are here: ${w}px`} />
    </div>
  );
}

export function Layout() {
  const { tokens, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  return (
    <>
      <PageHeader title="Spacing & layout" lede="Spacing scale, shape, breakpoints and z-index. Pixel values are measured live." source={model.themeEntry} />
      <section className="dl-section">
        <h2>Spacing</h2>
        <table className="dl-table"><thead><tr><th>Token</th><th>Value</th><th>Measured</th><th /></tr></thead>
          <tbody>{tokens.spacing.map((s) => <SpacingRow key={s.factor} {...s} />)}</tbody>
        </table>
      </section>
      <section className="dl-section">
        <h2>Shape</h2>
        <div className="dl-row">
          {tokens.shape.map((s) => (
            <div key={s.name} className="dl-shape"><div className="dl-shape-square" style={{ borderRadius: s.value }} /><CopyChip text={`theme.shape.${s.name}`} /><span className="dl-muted">{s.value}</span></div>
          ))}
        </div>
      </section>
      <section className="dl-section">
        <h2>Breakpoints</h2>
        <Breakpoints bps={tokens.breakpoints} />
      </section>
      <section className="dl-section">
        <h2>Z-index</h2>
        <table className="dl-table"><tbody>
          {tokens.zIndex.map((z) => <tr key={z.name}><td><CopyChip text={`theme.zIndex.${z.name}`} /></td><td>{z.value}</td></tr>)}
        </tbody></table>
      </section>
    </>
  );
}
