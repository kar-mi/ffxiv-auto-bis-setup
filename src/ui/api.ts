import { API_BASE } from "./constants.ts";
import type { ItemData } from "../xivapi/item-data.ts";

const itemCache = new Map<number, Promise<ItemData>>();

export function fetchItemData(itemId: number): Promise<ItemData> {
  if (!itemCache.has(itemId)) {
    itemCache.set(itemId, fetch(`${API_BASE}/item/${itemId}`).then(r => r.json() as Promise<ItemData>));
  }
  return itemCache.get(itemId)!;
}
