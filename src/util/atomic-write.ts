import path from "path";
import { mkdir, rename } from "node:fs/promises";

export async function writeJsonAtomic(absPath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(absPath), { recursive: true });
  const tmp = `${absPath}.tmp`;
  const content = typeof value === "string" ? value : JSON.stringify(value);
  await Bun.write(tmp, content);
  await rename(tmp, absPath);
}
