import { useLoupe } from "../state";
import { href } from "../router";
import { PageHeader } from "../ui/PageHeader";
import { Panel } from "../ui/Panel";
import { CopyChip } from "../ui/CopyChip";

export function LibraryUsage() {
  const { model, overrides } = useLoupe();
  return (
    <>
      <PageHeader
        title={`${model.libraryName} used directly`}
        lede={`${model.libraryName} components imported straight from the library in feature code, outside your component folders. These bypass any house wrappers, but still pick up theme overrides.`}
      />
      {model.libraryUsage.length === 0 ? <p className="dl-muted">None: feature code only uses your own components.</p> : (
        <table className="dl-table">
          <thead><tr><th>Component</th><th>Uses</th><th>Customised by theme</th><th>Call sites</th></tr></thead>
          <tbody>
            {model.libraryUsage.map((u) => {
              const o = overrides.find((x) => x.component === u.component);
              return (
                <tr key={u.component}>
                  <td><strong>{u.component}</strong></td>
                  <td>{u.sites.length}</td>
                  <td>{o ? <a href={`${href("overrides")}#${o.key}`}>Theme overrides</a> : <span className="dl-muted">no</span>}</td>
                  <td><Panel title="Sites" count={u.sites.length}><ul className="dl-list">{u.sites.map((s, i) => <li key={i}><CopyChip text={`${s.file}:${s.line}`} /></li>)}</ul></Panel></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
