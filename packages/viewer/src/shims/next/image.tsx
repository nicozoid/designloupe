import type { CSSProperties, ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | { src: string }; fill?: boolean; priority?: unknown; placeholder?: unknown;
  blurDataURL?: unknown; loader?: unknown; quality?: unknown; unoptimized?: unknown;
};
const FILL: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };

/** Loupe shim for next/image: a plain <img>. */
export default function Image({ src, fill, priority, placeholder, blurDataURL, loader, quality, unoptimized, style, ...rest }: Props) {
  return <img src={typeof src === "string" ? src : src.src} style={fill ? { ...FILL, ...style } : style} {...rest} />;
}
