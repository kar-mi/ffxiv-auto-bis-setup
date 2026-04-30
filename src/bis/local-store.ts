import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomic } from '../util/atomic-write.ts';
import type { BisCatalog, LocalBisEntry, RaidTier } from '../types.ts';
import { normalizeXivgearUrl } from './xivgear.ts';

function catalogPath(projectRoot: string): string {
  return path.join(projectRoot, 'data', 'bis', 'catalog.json');
}


/**
 * Derive a stable, human-readable ID from a xivgear URL and set index.
 * e.g. `https://xivgear.app/?page=bis|war|current&selectedIndex=0` → `"bis_war_current_0"`
 */
export function makeEntryId(xivgearUrl: string, setIndex: number): string {
  try {
    const normalized = normalizeXivgearUrl(xivgearUrl);
    const page = new URL(normalized).searchParams.get('page') ?? '';
    const slug = page.replace(/[|]/g, '_');
    return `${slug}_${setIndex}`;
  } catch {
    // Fallback for malformed URLs
    return `set_${setIndex}_${Date.now()}`;
  }
}

/**
 * Build a canonical URL that has `selectedIndex` baked in so comparison
 * endpoints resolve the correct set without a separate `set=` parameter.
 */
export function canonicalUrl(xivgearUrl: string, setIndex: number): string {
  const normalized = normalizeXivgearUrl(xivgearUrl);
  const u = new URL(normalized);
  u.searchParams.set('selectedIndex', String(setIndex));
  return u.toString();
}

export async function loadCatalog(projectRoot: string): Promise<BisCatalog> {
  try {
    const raw = await readFile(catalogPath(projectRoot), 'utf-8');
    return JSON.parse(raw) as BisCatalog;
  } catch {
    return { sets: [], preferences: {} };
  }
}

export async function saveCatalog(projectRoot: string, catalog: BisCatalog): Promise<void> {
  await writeJsonAtomic(catalogPath(projectRoot), JSON.stringify(catalog, null, 2) + '\n');
}

export function upsertSet(catalog: BisCatalog, entry: LocalBisEntry): BisCatalog {
  const idx = catalog.sets.findIndex(s => s.id === entry.id);
  const sets = idx >= 0
    ? catalog.sets.map((s, i) => (i === idx ? entry : s))
    : [...catalog.sets, entry];
  return { ...catalog, sets };
}

/** Remove a set and clear any preference pointing to it. */
export function removeSet(catalog: BisCatalog, id: string): BisCatalog {
  const sets = catalog.sets.filter(s => s.id !== id);
  const preferences = Object.fromEntries(
    Object.entries(catalog.preferences).filter(([, v]) => v !== id),
  );
  return { sets, preferences };
}

export function setPreference(catalog: BisCatalog, job: string, id: string): BisCatalog {
  return { ...catalog, preferences: { ...catalog.preferences, [job.toUpperCase()]: id } };
}

export function clearPreference(catalog: BisCatalog, job: string): BisCatalog {
  const preferences = { ...catalog.preferences };
  delete preferences[job.toUpperCase()];
  return { ...catalog, preferences };
}

export type { RaidTier };
