import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const parent = fileURLToPath(new URL("../", import.meta.url));
// The compiled utility is in dist/utils; configuration and logs stay in the source workspace.
export const workspaceDir = existsSync(join(parent, "package.json")) ? parent : dirname(parent.replace(/\/$/, ""));
export function scriptDirectory(name: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error("Script names must use lowercase letters, digits, and hyphens");
  return join(workspaceDir, "scripts", name);
}
