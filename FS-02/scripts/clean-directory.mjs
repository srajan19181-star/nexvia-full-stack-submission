import { rm } from "node:fs/promises";

const directory = process.argv[2];
if (!directory || directory === "/" || directory.includes("..")) throw new Error("Unsafe directory");
await rm(directory, { recursive: true, force: true });
