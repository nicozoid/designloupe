declare module "next/link" {
  import type { AnchorHTMLAttributes, ReactElement, ReactNode } from "react";
  const Link: (props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => ReactElement;
  export default Link;
}
