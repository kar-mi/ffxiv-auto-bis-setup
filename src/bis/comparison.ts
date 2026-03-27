import type { GearSnapshot, BisGearSet, GearsetComparison, SlotComparison, SlotName } from '../types.ts';

const COMPARED_SLOTS: SlotName[] = [
  'mainHand', 'offHand',
  'head', 'chest', 'gloves', 'legs', 'feet',
  'earRings', 'necklace', 'bracelet', 'ring1', 'ring2',
];

function materiasMatch(equipped: number[], bis: number[]): boolean {
  const eq = [...equipped].filter(m => m > 0).sort((a, b) => a - b);
  const bm = [...bis].filter(m => m > 0).sort((a, b) => a - b);
  if (eq.length !== bm.length) return false;
  return eq.every((v, i) => v === bm[i]);
}

export function compareGear(snapshot: GearSnapshot, bis: BisGearSet): GearsetComparison {
  const slots: SlotComparison[] = [];
  let matchCount = 0;
  let wrongItemCount = 0;
  let wrongMateriaCount = 0;
  let missingCount = 0;

  for (const slot of COMPARED_SLOTS) {
    const equipped = snapshot.items[slot];
    const bisItem = bis.items[slot];

    if (!bisItem) {
      slots.push({ slot, status: 'bis-empty' });
      continue;
    }
    if (!equipped) {
      slots.push({ slot, status: 'missing', bisItemId: bisItem.itemId, bisMaterias: bisItem.materias });
      missingCount++;
      continue;
    }
    if (equipped.itemId !== bisItem.itemId) {
      slots.push({
        slot,
        status: 'wrong-item',
        equippedItemId: equipped.itemId,
        bisItemId: bisItem.itemId,
        equippedMaterias: equipped.materias,
        bisMaterias: bisItem.materias,
      });
      wrongItemCount++;
      continue;
    }
    if (!materiasMatch(equipped.materias, bisItem.materias)) {
      slots.push({
        slot,
        status: 'wrong-materia',
        equippedItemId: equipped.itemId,
        bisItemId: bisItem.itemId,
        equippedMaterias: equipped.materias,
        bisMaterias: bisItem.materias,
      });
      wrongMateriaCount++;
      continue;
    }
    slots.push({ slot, status: 'match', equippedItemId: equipped.itemId, bisItemId: bisItem.itemId });
    matchCount++;
  }

  return { slots, matchCount, wrongItemCount, wrongMateriaCount, missingCount };
}
