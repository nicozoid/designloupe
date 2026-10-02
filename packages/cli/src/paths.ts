import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
export const VIEWER_ROOT = path.join(REPO_ROOT, "packages/viewer");
export const NEXT_SHIMS_DIR = path.join(VIEWER_ROOT, "src/shims/next");
