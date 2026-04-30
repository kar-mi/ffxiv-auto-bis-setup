import { join } from "path";
import type { ServerCtx } from '../ctx.ts';
import { json } from '../helpers.ts';
import { fetchItemData } from '../../xivapi/item-data.ts';

const BASE_PARAM_STAT: Record<number, string> = {
  6: "PIE", 10: "GP", 11: "CP", 19: "TEN", 22: "DH",
  27: "CRIT", 44: "DET", 45: "SKS", 46: "SPS",
  70: "Crafts", 71: "Ctrl", 72: "Gath", 73: "Perc",
};

export interface MateriaStatEntry { stat: string; value: number }

let materiaStatsCache: Map<number, MateriaStatEntry> | null = null;

async function loadMateriaStats(projectRoot: string): Promise<Map<number, MateriaStatEntry>> {
  if (materiaStatsCache) return materiaStatsCache;
  const text = await Bun.file(join(projectRoot, "data", "materias.json")).text();
  const raw = JSON.parse(text) as { itemId: number; value: number; baseParamId: number }[];
  const map = new Map<number, MateriaStatEntry>();
  for (const { itemId, value, baseParamId } of raw) {
    if (itemId === 0) continue;
    const stat = BASE_PARAM_STAT[baseParamId] ?? `Param${baseParamId}`;
    map.set(itemId, { stat, value });
  }
  materiaStatsCache = map;
  return map;
}

export async function tryHandle(req: Request, ctx: ServerCtx): Promise<Response | null> {
  const { pathname } = new URL(req.url);

  if (pathname === "/materia-stats" && req.method === "GET") {
    const map = await loadMateriaStats(ctx.projectRoot);
    return json(Object.fromEntries(map));
  }

  const itemMatch = pathname.match(/^\/item\/(\d+)$/);
  if (itemMatch && req.method === "GET") {
    const itemId = Number(itemMatch[1]);
    return json(await fetchItemData(itemId));
  }

  return null;
}
