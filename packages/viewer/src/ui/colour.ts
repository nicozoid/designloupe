/** Rasterise a CSS colour through a 1×1 canvas → #rrggbb or #rrggbbaa. "" if unavailable. */
export function toHex(color: string): string {
  if (!color || typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  // An invalid colour leaves fillStyle unchanged, so it would read back as the previous colour (#000000 on a
  // fresh canvas). Assign it over two different sentinels: if both survive, the canvas rejected it.
  ctx.fillStyle = "#010203";
  ctx.fillStyle = color;
  const first = ctx.fillStyle;
  ctx.fillStyle = "#020304";
  ctx.fillStyle = color;
  if (first === "#010203" && ctx.fillStyle === "#020304") return "";
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return a === 255 ? `#${h(r!)}${h(g!)}${h(b!)}` : `#${h(r!)}${h(g!)}${h(b!)}${h(a!)}`;
}

/** Like toHex, but resolves var()/color-mix() by letting the browser compute it first. */
export function cssColourToHex(value: string): string {
  if (!/var\(|color-mix\(/.test(value)) return toHex(value);
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return toHex(computed);
}
