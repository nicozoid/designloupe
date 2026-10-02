import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import components from "virtual:loupe/components";
import { planAutoDemo, type ComponentInfo } from "@designloupe/core";
import { useLoupe } from "../state";
import { Preview } from "../ui/Preview";
import { ErrorCard } from "../ui/ErrorCard";
import { CopyChip } from "../ui/CopyChip";

type Loaded = { status: "loading" } | { status: "ok"; Comp: ComponentType<Record<string, unknown>> } | { status: "error"; message: string };

function useComponent(c: ComponentInfo): Loaded {
  const { reportFailure } = useLoupe();
  const [state, setState] = useState<Loaded>({ status: "loading" });
  useEffect(() => {
    let live = true;
    const load = components[c.id];
    if (!load) {
      setState({ status: "error", message: `No module registered for ${c.id}` });
      return;
    }
    load()
      .then((mod) => {
        const Comp = mod[c.exportName] as ComponentType<Record<string, unknown>> | undefined;
        if (!Comp) throw new Error(`Export "${c.exportName}" not found in ${c.file}`);
        if (live) setState({ status: "ok", Comp });
      })
      .catch((e: Error) => {
        reportFailure(c.id, `import: ${e.message}`);
        if (live) setState({ status: "error", message: e.message });
      });
    return () => {
      live = false;
    };
  }, [c.id, c.exportName, c.file, reportFailure]);
  return state;
}

/** Calls a loupe-file demo inside the boundary so a throwing demo is caught. */
function DemoFn({ fn }: { fn: () => ReactNode }) {
  return <>{fn()}</>;
}

function snippet(c: ComponentInfo): string {
  const importPath = `@target/${c.file.replace(/\.(tsx?|jsx?)$/, "")}`;
  const name = c.exportName === "default" ? c.name : c.exportName;
  const imp = c.exportName === "default" ? `import ${name} from "${importPath}";` : `import { ${name} } from "${importPath}";`;
  return `// <loupeDir>/components/${c.name}.loupe.tsx
import { defineComponentDoc } from "@designloupe/core";
${imp}

export default defineComponentDoc({
  component: "${c.file}",
  demo: () => <${name} /* required props here */ />,
});`;
}

export function Demo({ c }: { c: ComponentInfo }) {
  const { docs } = useLoupe();
  const doc = docs.get(c.id);
  const loaded = useComponent(c);

  if (doc?.demo) return <Preview id={c.id}><DemoFn fn={doc.demo} /></Preview>;
  if (loaded.status === "loading") return <div className="dl-stage dl-muted">Loading…</div>;
  if (loaded.status === "error") return <ErrorCard title="Import failed" message={loaded.message} />;

  const plan = planAutoDemo(c);
  if (plan.kind === "needs-demo") {
    return (
      <div className="dl-card dl-needs-demo">
        <strong>Needs a demo.</strong> Loupe can&rsquo;t fill the required prop{plan.missing.length > 1 ? "s" : ""} {plan.missing.map((m) => <code key={m}>{m}</code>)}. Add a loupe file:
        <pre className="dl-code">{snippet(c)}</pre>
        <CopyChip text={snippet(c)} label="Copy snippet" />
      </div>
    );
  }
  const { Comp } = loaded;
  const [a, b] = plan.axes;
  const cell = (props: Record<string, unknown>, label?: string) => (
    <div className="dl-demo-cell" key={label ?? "only"}>
      <Comp {...plan.base} {...props} />
      {label && <div className="dl-demo-label">{label}</div>}
    </div>
  );
  return (
    <Preview id={c.id}>
      {!a && cell({})}
      {a && !b && <div className="dl-demo-row">{a.values.map((v) => cell({ [a.prop]: v }, `${a.prop}="${v}"`))}</div>}
      {a && b && (
        <div className="dl-demo-table">
          {b.values.map((bv) => (
            <div className="dl-demo-row" key={bv}>
              {a.values.map((av) => cell({ [a.prop]: av, [b.prop]: bv }, `${a.prop}="${av}" ${b.prop}="${bv}"`))}
            </div>
          ))}
        </div>
      )}
    </Preview>
  );
}
