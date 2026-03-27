import type { BisGearSet, BisItem, SlotName } from '../types.ts';

const XIVGEAR_API = 'https://api.xivgear.app/fulldata';

/**
 * Normalize xivgear.app URLs to the ?page= format required by the API.
 * The Balance uses hash routing: https://xivgear.app/#/bis/war/prog
 * The API expects:            https://xivgear.app/?page=bis|war|prog
 */
function normalizeXivgearUrl(url: string): string {
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

function normalizeSet(raw: XivgearSet, job: string, source: string): BisGearSet {
  const items: Partial<Record<SlotName, BisItem>> = {};
  for (const [xivgearSlot, item] of Object.entries(raw.items)) {
    const slot = SLOT_MAP[xivgearSlot];
    if (!slot) continue;
    items[slot] = {
      itemId: item.id,
      slot,
      materias: (item.materia ?? []).map(m => m.id).filter(id => id > 0),
    };
  }
  return {
    name: raw.name,
    job,
    items,
    foodId: raw.food,
    source,
  };
}

export async function fetchBisSet(xivgearUrl: string, setIndex?: number): Promise<BisGearSet> {
  const normalized = normalizeXivgearUrl(xivgearUrl);
  // If setIndex not provided, check for selectedIndex in the URL itself
  const resolvedIndex = setIndex ?? Number(new URL(normalized).searchParams.get('selectedIndex') ?? 0);
  const apiUrl = `${XIVGEAR_API}?url=${encodeURIComponent(normalized)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`xivgear API returned ${res.status} for ${xivgearUrl}`);
  }
  const data = (await res.json()) as XivgearFullData;
  const set = data.sets[resolvedIndex];
  if (!set) {
    throw new Error(`Set index ${resolvedIndex} not found (${data.sets.length} sets available)`);
  }
  return normalizeSet(set, data.job, xivgearUrl);
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
  const apiUrl = `${XIVGEAR_API}?url=${encodeURIComponent(normalizeXivgearUrl(xivgearUrl))}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`xivgear API returned ${res.status} for ${xivgearUrl}`);
  }
  const data = (await res.json()) as XivgearFullData;
  return data.sets.map(s => s.name);
}
