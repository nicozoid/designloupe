import type { ReactElement } from "react";

/** Throws on render so the viewer's error boundary can be tested. */
export function Broken(): ReactElement {
  throw new Error("Broken on purpose");
}
