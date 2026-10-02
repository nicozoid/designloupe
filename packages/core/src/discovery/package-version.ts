import fs from "node:fs";
import path from "node:path";

/** Walk up from `root` looking for node_modules/<pkg>/package.json (works with hoisted monorepos). */
export function readPackageVersion(root: string, pkg: string): string | undefined {
  let dir = path.resolve(root);
  for (;;) {
    const candidate = path.join(dir, "node_modules", pkg, "package.json");
    if (fs.existsSync(candidate)) {
      try {
        return JSON.parse(fs.readFileSync(candidate, "utf8")).version;
      } catch {
        return undefined;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
