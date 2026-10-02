import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths";

const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];

/** The nearest lockfile at or above `root` (monorepo targets keep it at the workspace root). */
export function findLockfile(root: string): string | undefined {
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    for (const name of LOCKFILES) {
      const f = path.join(dir, name);
      if (fs.existsSync(f)) return f;
    }
    if (path.dirname(dir) === dir) return undefined;
  }
}

/** Per-target hash: the target's real path plus its lockfile contents, so each target (and each install) gets its own prebundle. */
export function targetHash(root: string): string {
  const h = createHash("sha256");
  let real = root;
  try {
    real = fs.realpathSync(root);
  } catch {}
  h.update(real);
  const lock = findLockfile(real);
  if (lock) h.update("\0").update(fs.readFileSync(lock));
  return h.digest("hex").slice(0, 16);
}

/** Vite's dep-optimiser cache for one target: `<repo>/node_modules/.vite/loupe-<hash>`. */
export const loupeCacheDir = (root: string) => path.join(REPO_ROOT, "node_modules/.vite", `loupe-${targetHash(root)}`);
