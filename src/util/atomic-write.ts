import path from "path";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

// Per-destination write queue. Concurrent saves to the same path serialize
// instead of racing on tmp files (ENOENT) or rename-to-same-target (EPERM on
// Windows). Different paths run in parallel as before.
const inFlight = new Map<string, Promise<void>>();

export function writeJsonAtomic(absPath: string, value: unknown): Promise<void> {
  const key = path.resolve(absPath);
  const prev = inFlight.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => doWrite(absPath, value));
  inFlight.set(key, next);
  // Drop the entry once this write settles, but only if no later write has
  // chained onto it in the meantime.
  void next.catch(() => {}).finally(() => {
    if (inFlight.get(key) === next) inFlight.delete(key);
  });
  return next;
}

async function doWrite(absPath: string, value: unknown): Promise<void> {
  const dir = path.dirname(absPath);
  await mkdir(dir, { recursive: true });
  const tmp = `${absPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  const content = typeof value === "string" ? value : JSON.stringify(value);
  try {
    await writeFile(tmp, content, "utf-8");
    await rename(tmp, absPath);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}
