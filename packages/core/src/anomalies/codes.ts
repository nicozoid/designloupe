/** 32-bit FNV-1a. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Stable 4-char base36 code for an automatic finding. */
export function anomalyCode(...parts: string[]): string {
  return (fnv1a(parts.join("|")) % 36 ** 4).toString(36).padStart(4, "0");
}
