import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { NoTheme } from "./NotFound";

export function Elevation() {
  const { tokens, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  return (
    <>
      <PageHeader title="Elevation" lede="The theme's shadow scale. Paper and Card use these via the elevation prop." source={model.themeEntry} />
      <div className="dl-grid">
        {tokens.shadows.map((s, i) => (
          <div key={i} className="dl-shadow-tile" style={{ boxShadow: s }}>
            <strong>{i}</strong>
            <CopyChip text={`theme.shadows[${i}]`} />
          </div>
        ))}
      </div>
    </>
  );
}
