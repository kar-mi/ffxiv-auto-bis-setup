/**
 * Fetches per-item master data from XIVAPI and caches results for the lifetime of the process.
 *
 * API: XIVAPI v2 — https://v2.xivapi.com/api
 * Endpoint: GET /sheet/Item/{itemId}?columns=IsAdvancedMeldingPermitted,MateriaSlotCount
 *
 * Response shape: { row_id, fields: { IsAdvancedMeldingPermitted: boolean, MateriaSlotCount: number, ... } }
 *   fields.IsAdvancedMeldingPermitted — whether the item allows overmelding (advanced melding)
 *   fields.MateriaSlotCount           — number of guaranteed (native) materia slots
 *
 * Example: https://v2.xivapi.com/api/sheet/Item/49648?columns=IsAdvancedMeldingPermitted,MateriaSlotCount
 */

const XIVAPI_BASE = 'https://v2.xivapi.com/api';

export interface ItemMasterData {
  canOvermeld: boolean;
  materiaSlots: number;
}

const cache = new Map<number, Promise<ItemMasterData>>();

export function fetchItemData(itemId: number): Promise<ItemMasterData> {
  if (!cache.has(itemId)) {
    cache.set(itemId, fetchFromXivapi(itemId));
  }
  return cache.get(itemId)!;
}

async function fetchFromXivapi(itemId: number): Promise<ItemMasterData> {
  try {
    const url = `${XIVAPI_BASE}/sheet/Item/${itemId}?fields=IsAdvancedMeldingPermitted,MateriaSlotCount'`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[item-data] XIVAPI ${itemId} returned ${res.status}; defaulting canOvermeld=false`);
      return { canOvermeld: false, materiaSlots: 0 };
    }
    const json = await res.json() as { fields: Record<string, unknown> };
    const fields = json.fields;
    return {
      canOvermeld: fields['IsAdvancedMeldingPermitted'] === true,
      materiaSlots: typeof fields['MateriaSlotCount'] === 'number' ? fields['MateriaSlotCount'] : 0,
    };
  } catch (err) {
    console.warn(`[item-data] Failed to fetch item ${itemId}:`, err);
    return { canOvermeld: false, materiaSlots: 0 };
  }
}
