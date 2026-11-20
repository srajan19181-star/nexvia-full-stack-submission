import { rm } from "node:fs/promises";
import path from "node:path";

const [targetArgument] = process.argv.slice(2);

if (!targetArgument) {
  throw new Error("A build directory argument is required");
}

const workspace = path.resolve(process.cwd());
const target = path.resolve(workspace, targetArgument);

if (path.basename(target) !== "dist" || !target.startsWith(`${workspace}${path.sep}`)) {
  throw new Error(`Refusing to clean unsafe build path: ${target}`);
}

await rm(target, { recursive: true, force: true });
