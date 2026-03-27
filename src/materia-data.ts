import type { MateriaEntry } from './materia.ts';

const DATA_PATH = 'data/materias.json';

/**
 * Loads materia resolution data from the bundled data file.
 * Each entry maps a packet materia type ID + tier to an FFXIV item ID.
 * Source: ffxiv-teamcraft/libs/data/src/lib/json/materias.json
 */
export async function loadMateriaData(): Promise<MateriaEntry[]> {
  const file = Bun.file(DATA_PATH);
  if (!(await file.exists())) {
    console.warn(`[materia] ${DATA_PATH} not found — materia will not be resolved`);
    return [];
  }
  const raw = await file.json() as { id: number; tier: number; itemId: number }[];
  return raw.map(({ id, tier, itemId }) => ({ id, tier, itemId }));
}
