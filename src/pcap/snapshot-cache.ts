import path from "path";
import { readFile, readdir } from "node:fs/promises";
import type { GearSnapshot, InventorySnapshot } from "../types.ts";
import { writeJsonAtomic } from "../util/atomic-write.ts";

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
  await writeJsonAtomic(path.join(cacheDir(projectRoot), "gear.json"), snapshot);
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
  await writeJsonAtomic(path.join(cacheDir(projectRoot), "inventory.json"), snapshot);
}

// ---- Per-classId gear cache -------------------------------------------------

export async function saveJobGearCache(projectRoot: string, classId: number, snapshot: GearSnapshot): Promise<void> {
  await writeJsonAtomic(path.join(cacheDir(projectRoot), `gear-${classId}.json`), snapshot);
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
