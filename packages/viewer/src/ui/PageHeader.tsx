import type { ReactNode } from "react";
import { CopyChip } from "./CopyChip";

export function PageHeader({ title, lede, source }: { title: string; lede?: ReactNode; source?: string }) {
  return (
    <header className="dl-page-header">
      <h1>{title}</h1>
      {lede && <p className="dl-lede">{lede}</p>}
      {source && (
        <p className="dl-source">
          defined in <CopyChip text={source} />
        </p>
      )}
    </header>
  );
}
