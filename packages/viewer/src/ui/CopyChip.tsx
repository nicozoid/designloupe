import { useState } from "react";

export function CopyChip({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <button type="button" className="dl-chip" onClick={copy} title="Copy">
      <code>{label ?? text}</code>
      <span aria-hidden className="dl-chip-icon">{done ? "✓" : "⧉"}</span>
    </button>
  );
}
