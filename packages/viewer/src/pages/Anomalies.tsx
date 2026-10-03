import { useEffect, useMemo, useState } from "react";
import components from "virtual:loupe/components";
import {
  buildAnomaly, categoryInfo, contrastAnomaly, findingsToAnomalies, mergeAnomalies, statusInfo,
  type Anomaly, type AnomalyStatus,
} from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { Badge, type Tone } from "../ui/Badge";
import { CopyChip } from "../ui/CopyChip";
import { measurePair } from "./Colour";

const TONE: Record<string, Tone> = { warn: "warn", info: "accent", good: "good", muted: "neutral" };

export function Anomalies() {
  const { model, adapter, theme, failures, reportFailure, authoredAnomalies } = useLoupe();
  const [filter, setFilter] = useState<AnomalyStatus | "all">("all");

  // Surface import failures without visiting every component page.
  useEffect(() => {
    for (const c of model.components) components[c.id]?.().catch((e: Error) => reportFailure(c.id, `import: ${e.message}`));
  }, [model.components, reportFailure]);

  const all = useMemo(() => {
    const auto: Anomaly[] = [...findingsToAnomalies(model.findings)];
    if (theme) {
      for (const p of adapter.contrastPairs(theme)) {
        const { ratio } = measurePair(theme, adapter.resolveColour, p);
        if (!Number.isNaN(ratio) && ratio < 4.5) auto.push(contrastAnomaly(p.mode, p.label, ratio));
      }
    }
    for (const [id, message] of Object.entries(failures)) auto.push(buildAnomaly(id, message));
    return mergeAnomalies(auto, authoredAnomalies);
  }, [model.findings, theme, adapter, failures, authoredAnomalies]);

  const shown = filter === "all" ? all : all.filter((a) => a.status === filter);
  const categories = [...new Set(shown.map((a) => a.category))];
  const count = (s: AnomalyStatus) => all.filter((a) => a.status === s).length;

  return (
    <>
      <PageHeader
        title="Anomalies"
        lede="Automatic findings (hard-coded values, low contrast, failed components) merged with the ones written in your anomalies file. Set a status in that file, using the same code, to mark one intentional. Render failures appear once a component has been viewed in this session."
      />
      <div className="dl-row dl-filters">
        <button type="button" className={`dl-filter${filter === "all" ? " is-active" : ""}`} onClick={() => setFilter("all")}>All {all.length}</button>
        {(Object.keys(statusInfo) as AnomalyStatus[]).map((s) => (
          <button key={s} type="button" className={`dl-filter${filter === s ? " is-active" : ""}`} onClick={() => setFilter(s)}>
            {statusInfo[s].name} {count(s)}
          </button>
        ))}
      </div>
      {categories.map((cat) => (
        <section key={cat} className="dl-section">
          <h2>{categoryInfo[cat].name}</h2>
          <p className="dl-lede">{categoryInfo[cat].description}</p>
          <div className="dl-stack">
            {shown.filter((a) => a.category === cat).map((a) => (
              <article key={a.id} className="dl-card dl-anomaly">
                <div className="dl-row">
                  <CopyChip text={a.id} />
                  <strong>{a.title}</strong>
                  <Badge tone={TONE[statusInfo[a.status].tone]}>{statusInfo[a.status].name}</Badge>
                  <span className="dl-muted">{a.flaggedBy === "human" ? "flagged by a person" : "found automatically"}</span>
                </div>
                <p>{a.description}</p>
                <div className="dl-row">{a.locations.map((l) => <CopyChip key={l} text={l} />)}</div>
                {a.fix && <p><strong>Fix:</strong> {a.fix}</p>}
                {a.note && <p className="dl-notes">{a.note}</p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
