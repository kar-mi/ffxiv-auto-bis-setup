import { API_BASE } from "./constants.ts";
import type { ItemData } from "../xivapi/item-data.ts";

const itemCache = new Map<number, Promise<ItemData>>();

export function fetchItemData(itemId: number): Promise<ItemData> {
  if (!itemCache.has(itemId)) {
    itemCache.set(itemId, fetch(`${API_BASE}/item/${itemId}`).then(r => r.json() as Promise<ItemData>));
  }
  return itemCache.get(itemId)!;
}

export async function fetchJson<T>(
  url: string,
  opts?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data: await res.json() as T };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
