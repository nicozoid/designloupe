import { APG, resolveWcag, rollupWcag, flattenOver, type A11yDoc } from "@designloupe/core";
import { useLoupe } from "../state";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import { cssColourToHex } from "../ui/colour";

const VERDICT = {
  "meets-aa": <Badge tone="good">Meets AA</Badge>,
  "partial-aa": <Badge tone="warn">Partial AA</Badge>,
  "fails-aa": <Badge tone="bad">Fails AA</Badge>,
  unknown: <Badge>Not assessed</Badge>,
} as const;

export function A11yPanel({ a11y }: { a11y: A11yDoc }) {
  const { adapter, theme, mode } = useLoupe();
  const resolve = (path: string) => cssColourToHex(adapter.resolveColour(theme, mode, path) ?? "");
  const rows = resolveWcag(a11y.checks ?? [], resolve).map((r) =>
    r.measured?.fgHex && r.measured.bgHex ? { ...r, measured: { ...r.measured, fgHex: flattenOver(r.measured.fgHex, r.measured.bgHex) } } : r,
  );
  const rollup = rollupWcag(rows);
  const pattern = a11y.pattern ? APG[a11y.pattern] : undefined;
  return (
    <Panel title="Accessibility" count={rows.length}>
      <div className="dl-row">{VERDICT[rollup.verdict]}{pattern && <a href={pattern.href} target="_blank" rel="noreferrer">APG: {pattern.name}</a>}{a11y.role && <span>role <code>{a11y.role}</code></span>}{a11y.name && <span>name: {a11y.name}</span>}</div>
      {a11y.keyboard?.length ? (
        <>
          <h4>Keyboard</h4>
          <table className="dl-table"><tbody>{a11y.keyboard.map((k) => <tr key={k.keys}><td><kbd>{k.keys}</kbd></td><td>{k.does}</td></tr>)}</tbody></table>
        </>
      ) : null}
      {rows.length > 0 && (
        <>
          <h4>WCAG 2.2</h4>
          <table className="dl-table">
            <thead><tr><th>SC</th><th>Criterion</th><th>Level</th><th>Status</th><th>Evidence</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.sc}-${i}`}>
                  <td>{r.href ? <a href={r.href} target="_blank" rel="noreferrer">{r.sc}</a> : r.sc}</td>
                  <td>{r.name}{r.measured?.label && <div className="dl-muted">{r.measured.label}</div>}</td>
                  <td>{r.level}</td>
                  <td>{r.status ? <Badge tone={r.status === "fail" ? "bad" : r.status === "partial" ? "warn" : "good"}>{r.status}</Badge> : <Badge>pending</Badge>}</td>
                  <td>{r.measured?.ratio !== undefined ? `${r.measured.ratio.toFixed(2)}:1 (needs ${r.measured.threshold})` : r.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
