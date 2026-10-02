import { hintFor } from "@designloupe/core";

export function ErrorCard({ title, message, hint }: { title: string; message: string; hint?: string }) {
  const h = hint ?? hintFor(message);
  return (
    <div className="dl-error" role="alert">
      <strong>{title}</strong>
      <pre>{message}</pre>
      {h && <p className="dl-hint">→ {h}</p>}
    </div>
  );
}
