import type {
  BisGearSet,
  GearNeeds,
  GearsetComparison,
  InventorySnapshot,
  ItemNeed,
  MateriaChange,
} from '../types.ts';
import { buildItemCounts } from '../inventory/counts.ts';
import { multisetDiff } from './multiset.ts';

function buildMateriaChange(
  slotComp: GearsetComparison['slots'][number],
  bis: BisGearSet,
  bagCounts: Map<number, number>,
): MateriaChange | null {
  const bisItem = bis.items[slotComp.slot];
  if (!bisItem) return null;

  const equipped = slotComp.status === 'wrong-materia'
    ? (slotComp.equippedMaterias ?? [])
    : [];
  const bisMs = slotComp.bisMaterias ?? bisItem.materias;

  const { onlyA: toRemove, onlyB: toAdd } = multisetDiff(equipped, bisMs);
  if (toAdd.length === 0 && toRemove.length === 0) return null;

  const quantityInBags: Record<number, number> = {};
  for (const mId of toAdd) {
    quantityInBags[mId] = bagCounts.get(mId) ?? 0;
  }

  return {
    slot: slotComp.slot,
    bisItemId: bisItem.itemId,
    toAdd,
    toRemove,
    quantityInBags,
  };
}

/**
 * Compute what a player still needs to acquire or re-meld to complete a BIS set.
 *
 * - `wrong-item` / `missing` slots → adds an ItemNeed with inventory cross-reference
 * - slots with missing/wrong materia → adds a MateriaChange listing what to add/remove
 */
export function computeNeeds(
  comparison: GearsetComparison,
  bis: BisGearSet,
  inventory: InventorySnapshot | null,
): GearNeeds {
  const bagCounts = buildItemCounts(inventory);

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

    if (slotComp.status === 'wrong-item' || slotComp.status === 'missing' || slotComp.status === 'wrong-materia') {
      const change = buildMateriaChange(slotComp, bis, bagCounts);
      if (change) materiaChanges.push(change);
    }
  }

  return { itemNeeds, materiaChanges };
}
