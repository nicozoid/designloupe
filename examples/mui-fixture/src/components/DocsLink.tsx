import type { ReactNode } from "react";
import NextLink from "next/link";

export interface DocsLinkProps {
  href: string;
  children: ReactNode;
}

/** Link to docs. Imports next/link, which Loupe must shim. */
export function DocsLink({ href, children }: DocsLinkProps) {
  return <NextLink href={href}>{children}</NextLink>;
}
