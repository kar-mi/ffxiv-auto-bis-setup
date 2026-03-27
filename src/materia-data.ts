import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MateriaEntry } from './materia.ts';

/**
 * Loads materia resolution data from the bundled data file.
 * Each entry maps a packet materia type ID + tier to an FFXIV item ID.
 * Source: ffxiv-teamcraft/libs/data/src/lib/json/materias.json
 *
 * Uses node:fs/promises so this works in both Bun and Node (pcap-host runs under Node).
 */
export async function loadMateriaData(projectRoot: string): Promise<MateriaEntry[]> {
  const dataPath = join(projectRoot, 'data', 'materias.json');
  let text: string;
  try {
    text = await readFile(dataPath, 'utf8');
  } catch {
    console.warn(`[materia] ${dataPath} not found — materia will not be resolved`);
    return [];
  }
  const raw = JSON.parse(text) as { id: number; tier: number; itemId: number }[];
  return raw.map(({ id, tier, itemId }) => ({ id, tier, itemId }));
}
