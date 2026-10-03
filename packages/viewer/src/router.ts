import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const read = () => window.location.hash;

/** A malformed % escape (e.g. a hand-typed "#/search/100%") keeps its raw text instead of throwing. */
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Hash routes: #/tokens/colour, #/components/<group>/<Name>, #/search/<q>. */
export function useRoute(): { segments: string[] } {
  const hash = useSyncExternalStore(subscribe, read, read);
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decode);
  return { segments };
}

export const href = (...segments: string[]) => `#/${segments.map(encodeURIComponent).join("/")}`;
