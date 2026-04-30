import { API_BASE } from "./constants.ts";
import type { ItemData } from "../xivapi/item-data.ts";

const itemCache = new Map<number, Promise<ItemData>>();

export function fetchItemData(itemId: number): Promise<ItemData> {
  let pending = itemCache.get(itemId);
  if (!pending) {
    pending = fetch(`${API_BASE}/item/${itemId}`).then(r => {
      if (!r.ok) throw new Error(`item ${itemId} failed (${r.status})`);
      return r.json() as Promise<ItemData>;
    });
    pending.catch(() => itemCache.delete(itemId));
    itemCache.set(itemId, pending);
  }
  return pending;
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
