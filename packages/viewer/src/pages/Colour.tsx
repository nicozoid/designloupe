import { contrastRatio, flattenOver, type ColourToken, type ContrastPair } from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { Badge } from "../ui/Badge";
import { cssColourToHex } from "../ui/colour";
import { NoTheme } from "./NotFound";

function Swatch({ token }: { token: ColourToken }) {
  const { tokenNotes } = useLoupe();
  const hex = cssColourToHex(token.value);
  const note = tokenNotes[token.path];
  return (
    <div className="dl-swatch">
      <div className="dl-swatch-colour" style={{ background: token.value }} />
      <div className="dl-swatch-meta">
        <strong>{token.path.split(".").pop()}</strong>
        <CopyChip text={token.path} />
        <span className="dl-muted">{hex || token.value}</span>
        {note && <span className="dl-swatch-note">{note}</span>}
      </div>
    </div>
  );
}

export function verdict(ratio: number) {
  if (Number.isNaN(ratio)) return <Badge>Unknown</Badge>;
  if (ratio >= 7) return <Badge tone="good">AAA</Badge>;
  if (ratio >= 4.5) return <Badge tone="good">AA</Badge>;
  if (ratio >= 3) return <Badge tone="warn">AA large only</Badge>;
  return <Badge tone="bad">Fails</Badge>;
}

export function measurePair(theme: unknown, resolve: (t: unknown, m: ContrastPair["mode"], p: string) => string | undefined, p: ContrastPair) {
  const fg = resolve(theme, p.mode, p.fg) ?? "";
  const bg = resolve(theme, p.mode, p.bg) ?? "";
  const bgHex = cssColourToHex(bg);
  const fgHex = flattenOver(cssColourToHex(fg), bgHex);
  return { fg, bg, ratio: contrastRatio(fgHex, bgHex) };
}

export function Colour() {
  const { tokens, theme, adapter, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  const pairs = adapter.contrastPairs(theme);
  return (
    <>
      <PageHeader title="Colour" lede="Palette roles read live from the theme. Custom palette keys appear automatically." source={model.themeEntry} />
      <div className="dl-cols">
        {tokens.schemes.map((s) => (
          <section key={s.mode} className="dl-stack">
            <h2>{s.mode === "dark" ? "Dark" : "Light"} scheme</h2>
            {s.groups.map((g) => (
              <div className="dl-card" key={g.name} id={`${s.mode}-${g.name}`}>
                <h3 className="dl-card-title">{g.name}</h3>
                <div className="dl-swatches">{g.tokens.map((t) => <Swatch key={t.path} token={t} />)}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
      <section className="dl-section">
        <h2>Contrast</h2>
        <p className="dl-lede">WCAG 2.2 contrast for each role's text on its fill, and body text on backgrounds. Measured from the resolved colours.</p>
        <table className="dl-table">
          <thead><tr><th>Scheme</th><th>Pair</th><th>Sample</th><th>Ratio</th><th>Verdict</th></tr></thead>
          <tbody>
            {pairs.map((p) => {
              const m = measurePair(theme, adapter.resolveColour, p);
              return (
                <tr key={`${p.mode}-${p.label}`}>
                  <td>{p.mode}</td>
                  <td>{p.label}</td>
                  <td><span className="dl-sample" style={{ background: m.bg, color: m.fg }}>Aa</span></td>
                  <td>{Number.isNaN(m.ratio) ? "—" : `${m.ratio.toFixed(2)}:1`}</td>
                  <td>{verdict(m.ratio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
