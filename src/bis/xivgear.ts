import type { BisGearSet, BisItem, SlotName } from '../types.ts';
import { fetchItemData } from '../xivapi/item-data.ts';

const XIVGEAR_API = 'https://api.xivgear.app/fulldata';

/**
 * In-memory cache for raw xivgear API responses, keyed by API URL.
 * Stores Promises so concurrent requests for the same URL share a single fetch.
 */
const fullDataCache = new Map<string, Promise<XivgearFullData>>();

function fetchFullData(xivgearUrl: string): Promise<XivgearFullData> {
  const apiUrl = `${XIVGEAR_API}?url=${encodeURIComponent(normalizeXivgearUrl(xivgearUrl))}`;
  let pending = fullDataCache.get(apiUrl);
  if (!pending) {
    pending = fetch(apiUrl).then(async res => {
      if (!res.ok) throw new Error(`xivgear API returned ${res.status} for ${xivgearUrl}`);
      return res.json() as Promise<XivgearFullData>;
    });
    pending.catch(() => fullDataCache.delete(apiUrl));
    fullDataCache.set(apiUrl, pending);
  }
  return pending;
}

/** In-memory cache for normalized BisGearSet objects, keyed by `${url}#${setIndex}`. */
const bisSetCache = new Map<string, BisGearSet>();

/**
 * Normalize xivgear.app URLs to the ?page= format required by the API.
 * The Balance uses hash routing: https://xivgear.app/#/bis/war/prog
 * The API expects:            https://xivgear.app/?page=bis|war|prog
 */
export function normalizeXivgearUrl(url: string): string {
  const hashMatch = url.match(/^https:\/\/xivgear\.app\/#\/(.+)$/);
  if (hashMatch) {
    const page = hashMatch[1].replace(/\//g, '|');
    return `https://xivgear.app/?page=${page}`;
  }
  return url;
}

const SLOT_MAP: Record<string, SlotName> = {
  Weapon:    'mainHand',
  OffHand:   'offHand',
  Head:      'head',
  Body:      'chest',
  Hand:      'gloves',
  Legs:      'legs',
  Feet:      'feet',
  Ears:      'earRings',
  Neck:      'necklace',
  Wrist:     'bracelet',
  RingLeft:  'ring1',
  Ring1:     'ring1',
  RingRight: 'ring2',
  Ring2:     'ring2',
};

interface XivgearMateria {
  id: number;
  locked: boolean;
}

interface XivgearItem {
  id: number;
  materia?: XivgearMateria[];
}

interface XivgearSet {
  name: string;
  /** Keyed by xivgear slot name, e.g. "Body", "Ears" */
  items: Record<string, XivgearItem>;
  food?: number;
}

interface XivgearFullData {
  name: string;
  job: string;
  sets: XivgearSet[];
}

async function normalizeSet(raw: XivgearSet, job: string, source: string): Promise<BisGearSet> {
  const entries = Object.entries(raw.items)
    .map(([xivgearSlot, item]) => ({ slot: SLOT_MAP[xivgearSlot], item }))
    .filter((e): e is { slot: SlotName; item: XivgearItem } => e.slot !== undefined);

  const itemLevels = await Promise.all(
    entries.map(({ item }) => fetchItemData(item.id).then(d => d.itemLevel).catch(() => undefined)),
  );

  const items: Partial<Record<SlotName, BisItem>> = {};
  for (let i = 0; i < entries.length; i++) {
    const { slot, item } = entries[i]!;
    items[slot] = {
      itemId: item.id,
      materias: (item.materia ?? []).map(m => m.id).filter(id => id > 0),
      itemLevel: itemLevels[i],
    };
  }
  return { name: raw.name, job, items, foodId: raw.food, source };
}

/**
 * Fetch a single normalized BIS set. Results are cached by (url, setIndex).
 * Prefer this over fetchBisSet when the index is already resolved.
 */
export async function getBisSet(xivgearUrl: string, setIndex: number): Promise<BisGearSet> {
  const cacheKey = `${xivgearUrl}#${setIndex}`;
  const cached = bisSetCache.get(cacheKey);
  if (cached) return cached;
  const data = await fetchFullData(xivgearUrl);
  const set = data.sets[setIndex];
  if (!set) {
    throw new Error(`Set index ${setIndex} not found (${data.sets.length} sets available)`);
  }
  const bisSet = await normalizeSet(set, data.job, xivgearUrl);
  bisSetCache.set(cacheKey, bisSet);
  return bisSet;
}

export async function fetchBisSet(xivgearUrl: string, setIndex?: number): Promise<BisGearSet> {
  const normalized = normalizeXivgearUrl(xivgearUrl);
  // If setIndex not provided, check for selectedIndex in the URL itself
  const resolvedIndex = setIndex ?? Number(new URL(normalized).searchParams.get('selectedIndex') ?? 0);
  return getBisSet(xivgearUrl, resolvedIndex);
}

/**
 * Resolve a `set` param (numeric index string or set name) to a 0-based index.
 * If `setParam` is undefined, falls back to `selectedIndex` in the URL, then 0.
 */
export async function resolveSetIndex(xivgearUrl: string, setParam?: string): Promise<number> {
  if (setParam === undefined) {
    return Number(new URL(normalizeXivgearUrl(xivgearUrl)).searchParams.get('selectedIndex') ?? 0);
  }
  const asInt = parseInt(setParam, 10);
  if (!isNaN(asInt) && String(asInt) === setParam) return asInt;
  // Try matching by name
  const names = await fetchSetNames(xivgearUrl);
  const idx = names.indexOf(setParam);
  if (idx === -1) throw new Error(`Set "${setParam}" not found. Available: ${names.join(', ')}`);
  return idx;
}

/** Returns the names of all available sets for a given xivgear URL. */
export async function fetchSetNames(xivgearUrl: string): Promise<string[]> {
  const data = await fetchFullData(xivgearUrl);
  return data.sets.map(s => s.name);
}
