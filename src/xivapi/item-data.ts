/**
 * Fetches per-item data from XIVAPI and caches results for the lifetime of the process.
 *
 * API: XIVAPI v2 — https://v2.xivapi.com/api
 * Endpoint: GET /sheet/Item/{itemId}?fields=IsAdvancedMeldingPermitted,MateriaSlotCount,Name,Icon,LevelItem
 *
 * Response shape: { row_id, fields: { ... } }
 *   fields.IsAdvancedMeldingPermitted — whether the item allows overmelding
 *   fields.MateriaSlotCount           — number of guaranteed (native) materia slots
 *   fields.Name                       — item display name
 *   fields.Icon                       — icon descriptor with path_hr1 / path
 *   fields.LevelItem                  — item level (number or { value: number })
 */

const XIVAPI_BASE = 'https://v2.xivapi.com/api';

const FIELDS = 'IsAdvancedMeldingPermitted,MateriaSlotCount,Name,Icon,LevelItem';

export interface ItemData {
  // Meld / gear processing
  canOvermeld: boolean;
  materiaSlots: number;
  // Display
  name: string;
  icon: string | null;
  itemLevel: number;
}

const cache = new Map<number, Promise<ItemData>>();
const resolved = new Map<number, ItemData>();

export function fetchItemData(itemId: number): Promise<ItemData> {
  if (!cache.has(itemId)) {
    const p = fetchFromXivapi(itemId);
    cache.set(itemId, p);
    void p.then(data => resolved.set(itemId, data));
  }
  return cache.get(itemId)!;
}

/** Returns the cached ItemData synchronously if already fetched, otherwise undefined. */
export function peekItemData(itemId: number): ItemData | undefined {
  return resolved.get(itemId);
}

function fallback(itemId: number): ItemData {
  return { canOvermeld: false, materiaSlots: 0, name: `Item #${itemId}`, icon: null, itemLevel: 0 };
}

async function fetchFromXivapi(itemId: number): Promise<ItemData> {
  try {
    const url = `${XIVAPI_BASE}/sheet/Item/${itemId}?fields=${FIELDS}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[item-data] XIVAPI ${itemId} returned ${res.status}`);
      return fallback(itemId);
    }
    const json = await res.json() as { fields: Record<string, unknown> };
    const f = json.fields;

    const iconRaw = f['Icon'] as { path_hr1?: string; path?: string } | null | undefined;
    const iconPath = iconRaw?.path_hr1 ?? iconRaw?.path ?? null;
    const levelItem = f['LevelItem'];

    return {
      canOvermeld: f['IsAdvancedMeldingPermitted'] === true,
      materiaSlots: typeof f['MateriaSlotCount'] === 'number' ? f['MateriaSlotCount'] : 0,
      name: typeof f['Name'] === 'string' ? f['Name'] : `Item #${itemId}`,
      icon: iconPath ? `${XIVAPI_BASE}/asset/${iconPath}?format=png` : null,
      itemLevel: typeof levelItem === 'number' ? levelItem
        : typeof (levelItem as Record<string, unknown> | null | undefined)?.['value'] === 'number'
          ? (levelItem as { value: number }).value : 0,
    };
  } catch (err) {
    console.warn(`[item-data] Failed to fetch item ${itemId}:`, err);
    return fallback(itemId);
  }
}
