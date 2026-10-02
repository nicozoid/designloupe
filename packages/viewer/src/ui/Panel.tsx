import type { ReactNode } from "react";

export function Panel({ title, count, defaultOpen, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="dl-panel" open={defaultOpen}>
      <summary>
        {title}
        {count !== undefined && <span className="dl-count">{count}</span>}
      </summary>
      <div className="dl-panel-body">{children}</div>
    </details>
  );
}
