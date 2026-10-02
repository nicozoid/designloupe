import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";

export interface NavLinkButtonProps {
  to: string;
  children: ReactNode;
}

/** Button that navigates. Needs router context. */
export function NavLinkButton({ to, children }: NavLinkButtonProps) {
  const navigate = useNavigate();
  return <Button onClick={() => navigate(to)}>{children}</Button>;
}
