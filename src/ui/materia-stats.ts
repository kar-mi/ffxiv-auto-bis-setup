import { API_BASE } from "./constants.ts";
import { materiaStatsMap, type MateriaStatEntry } from "./state.ts";

export async function loadMateriaStats(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/materia-stats`);
    if (!res.ok) return;
    const raw = await res.json() as Record<string, MateriaStatEntry>;
    const map = new Map<number, MateriaStatEntry>();
    for (const [k, v] of Object.entries(raw)) map.set(Number(k), v);
    materiaStatsMap.value = map;
  } catch {
    // non-fatal: labels degrade to name-only
  }
}
