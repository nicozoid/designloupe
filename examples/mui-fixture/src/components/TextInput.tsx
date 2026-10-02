import { TextField } from "@mui/material";

export interface TextInputProps {
  /** Visible label. */
  label: string;
  helperText?: string;
  type?: "text" | "email" | "password";
}

/** Single-line text input with the house defaults. */
export function TextInput({ label, helperText, type = "text" }: TextInputProps) {
  return <TextField label={label} helperText={helperText} type={type} />;
}
