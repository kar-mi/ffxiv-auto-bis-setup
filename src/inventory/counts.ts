import type { InventorySnapshot } from '../types.ts';

export function buildItemCounts(inventory: InventorySnapshot | null): Map<number, number> {
  const counts = new Map<number, number>();
  if (!inventory) return counts;
  for (const item of inventory.items) {
    if (item.itemId === 0 || item.quantity === 0) continue;
    counts.set(item.itemId, (counts.get(item.itemId) ?? 0) + item.quantity);
  }
  return counts;
}
