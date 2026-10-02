import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

type Href = string | { pathname?: string; query?: Record<string, string> };
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Href; children?: ReactNode; prefetch?: unknown; replace?: unknown; scroll?: unknown;
  shallow?: unknown; legacyBehavior?: unknown; passHref?: unknown; locale?: unknown;
};

/** Loupe shim for next/link: a plain anchor that never navigates away from the viewer. */
export default function Link({ href, children, prefetch, replace, scroll, shallow, legacyBehavior, passHref, locale, onClick, ...rest }: Props) {
  const h = typeof href === "string" ? href : (href.pathname ?? "#");
  return (
    <a href={h} {...rest} onClick={(e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); onClick?.(e); }}>
      {children}
    </a>
  );
}
