import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const read = () => window.location.hash;

/** Hash routes: #/tokens/colour, #/components/<group>/<Name>, #/search/<q>. */
export function useRoute(): { segments: string[] } {
  const hash = useSyncExternalStore(subscribe, read, read);
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  return { segments };
}

export const href = (...segments: string[]) => `#/${segments.map(encodeURIComponent).join("/")}`;
