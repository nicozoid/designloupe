import type { ResolvedConfig } from "@designloupe/core";
/** Implemented in a later task. */
export async function runDoctor(_config: ResolvedConfig, log: (line: string) => void = console.log): Promise<number> {
  log("designloupe doctor is not implemented yet.");
  return 1;
}
