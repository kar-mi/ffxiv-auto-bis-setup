import path from "path";
import { mkdir, rename, writeFile } from "node:fs/promises";

export async function writeJsonAtomic(absPath: string, value: unknown): Promise<void> {
  const dir = path.dirname(absPath);
  await mkdir(dir, { recursive: true });
  const tmp = `${absPath}.tmp`;
  const content = typeof value === "string" ? value : JSON.stringify(value);
  await writeFile(tmp, content, "utf-8");
  await rename(tmp, absPath);
}
