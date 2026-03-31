import type {
  BisGearSet,
  GearNeeds,
  GearsetComparison,
  InventorySnapshot,
  ItemNeed,
  MateriaChange,
} from '../types.ts';

/**
 * Compute what a player still needs to acquire or re-meld to complete a BIS set.
 *
 * - `wrong-item` / `missing` slots → adds an ItemNeed with inventory cross-reference
 * - `wrong-materia` slots → adds a MateriaChange listing what to add/remove
 */
export function computeNeeds(
  comparison: GearsetComparison,
  bis: BisGearSet,
  inventory: InventorySnapshot | null,
): GearNeeds {
  const bagCounts = buildBagCounts(inventory);

  const itemNeeds: ItemNeed[] = [];
  const materiaChanges: MateriaChange[] = [];

  for (const slotComp of comparison.slots) {
    if (slotComp.status === 'wrong-item' || slotComp.status === 'missing') {
      const bisItemId = slotComp.bisItemId!;
      itemNeeds.push({
        slot: slotComp.slot,
        reason: slotComp.status,
        bisItemId,
        equippedItemId: slotComp.equippedItemId,
        quantityInBags: bagCounts.get(bisItemId) ?? 0,
      });
    }

    if (slotComp.status === 'wrong-materia') {
      const bisItem = bis.items[slotComp.slot];
      if (!bisItem) continue;

      const equipped = [...(slotComp.equippedMaterias ?? [])].filter(m => m > 0);
      const bisMs = [...(slotComp.bisMaterias ?? [])].filter(m => m > 0);

      const toAdd = subtractList(bisMs, equipped);
      const toRemove = subtractList(equipped, bisMs);

      const quantityInBags: Record<number, number> = {};
      for (const mId of toAdd) {
        quantityInBags[mId] = bagCounts.get(mId) ?? 0;
      }

      materiaChanges.push({
        slot: slotComp.slot,
        bisItemId: bisItem.itemId,
        toAdd,
        toRemove,
        quantityInBags,
      });
    }
  }

  return { itemNeeds, materiaChanges };
}

/** Build a map of itemId → total quantity across all tracked inventory containers. */
function buildBagCounts(inventory: InventorySnapshot | null): Map<number, number> {
  const counts = new Map<number, number>();
  if (!inventory) return counts;
  for (const item of inventory.items) {
    counts.set(item.itemId, (counts.get(item.itemId) ?? 0) + item.quantity);
  }
  return counts;
}

/**
 * Multiset subtraction: returns elements in `a` that are not covered by `b`.
 * e.g. subtractList([1,1,2], [1,2]) → [1]
 */
function subtractList(a: number[], b: number[]): number[] {
  const remaining = [...b];
  const result: number[] = [];
  for (const v of a) {
    const idx = remaining.indexOf(v);
    if (idx !== -1) {
      remaining.splice(idx, 1);
    } else {
      result.push(v);
    }
  }
  return result;
}
