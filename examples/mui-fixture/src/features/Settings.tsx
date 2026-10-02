import { PrimaryButton } from "@/components/PrimaryButton";
import { TextInput } from "@/components/TextInput";
import { EmptyState } from "@/components/EmptyState";

export function Settings() {
  return (
    <form>
      <TextInput label="Email" type="email" />
      <EmptyState />
      <PrimaryButton type="submit">Save</PrimaryButton>
      <PrimaryButton tone="brand">Upgrade</PrimaryButton>
    </form>
  );
}
