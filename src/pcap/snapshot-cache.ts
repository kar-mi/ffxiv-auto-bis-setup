import path from "path";
import { writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import type { GearSnapshot, InventorySnapshot } from "../types.ts";

const CACHE_DIR = "data/cache";

function cacheDir(projectRoot: string): string {
  return path.join(projectRoot, CACHE_DIR);
}

export async function loadGearCache(projectRoot: string): Promise<GearSnapshot | null> {
  try {
    const data = await readFile(path.join(cacheDir(projectRoot), "gear.json"), "utf-8");
    return JSON.parse(data) as GearSnapshot;
  } catch {
    return null;
  }
}

export async function saveGearCache(projectRoot: string, snapshot: GearSnapshot): Promise<void> {
  const dir = cacheDir(projectRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "gear.json"), JSON.stringify(snapshot));
}

export async function loadInventoryCache(projectRoot: string): Promise<InventorySnapshot | null> {
  try {
    const data = await readFile(path.join(cacheDir(projectRoot), "inventory.json"), "utf-8");
    return JSON.parse(data) as InventorySnapshot;
  } catch {
    return null;
  }
}

export async function saveInventoryCache(projectRoot: string, snapshot: InventorySnapshot): Promise<void> {
  const dir = cacheDir(projectRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "inventory.json"), JSON.stringify(snapshot));
}

// ---- Per-classId gear cache -------------------------------------------------

export async function saveJobGearCache(projectRoot: string, classId: number, snapshot: GearSnapshot): Promise<void> {
  const dir = cacheDir(projectRoot);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `gear-${classId}.json`), JSON.stringify(snapshot));
}

export async function loadJobGearCache(projectRoot: string, classId: number): Promise<GearSnapshot | null> {
  try {
    const data = await readFile(path.join(cacheDir(projectRoot), `gear-${classId}.json`), "utf-8");
    return JSON.parse(data) as GearSnapshot;
  } catch {
    return null;
  }
}

export async function listJobGearCaches(projectRoot: string): Promise<Array<{ classId: number; capturedAt: string }>> {
  try {
    const dir = cacheDir(projectRoot);
    const files = await readdir(dir);
    const results: Array<{ classId: number; capturedAt: string }> = [];
    for (const file of files) {
      const match = file.match(/^gear-(\d+)\.json$/);
      if (!match) continue;
      const classId = Number(match[1]);
      try {
        const raw = await readFile(path.join(dir, file), "utf-8");
        const snap = JSON.parse(raw) as GearSnapshot;
        results.push({ classId, capturedAt: snap.capturedAt });
      } catch {
        // skip corrupted cache files
      }
    }
    return results;
  } catch {
    return [];
  }
}
