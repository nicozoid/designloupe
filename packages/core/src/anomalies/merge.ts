import type { Anomaly, AnomalyStatus } from "../loupe-files";

const ORDER: Record<AnomalyStatus, number> = { open: 0, todo: 1, intentional: 2, fixed: 3 };

export function mergeAnomalies(auto: Anomaly[], authored: Anomaly[]): Anomaly[] {
  const byId = new Map(authored.map((a) => [a.id, a]));
  const merged = auto.map((a) => {
    const o = byId.get(a.id);
    if (!o) return a;
    byId.delete(a.id);
    return { ...a, status: o.status, note: o.note ?? a.note, fix: o.fix ?? a.fix };
  });
  for (const a of byId.values()) merged.push({ flaggedBy: "human", ...a });
  return merged.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.id.localeCompare(b.id));
}
