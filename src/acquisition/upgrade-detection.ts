import type { GearNeeds, BisGearSet } from '../types.ts';
import type { GearAcquisitionMap } from './types.ts';
import { fetchItemData } from '../xivapi/item-data.ts';

export function getBaseItemId(bisItemId: number, upgradeOffset: number): number {
  return bisItemId - upgradeOffset;
}

export async function confirmUpgradeMatch(
  baseItemId: number,
  baseILevel: number,
  lookup: (id: number) => Promise<{ itemLevel: number }> = fetchItemData,
): Promise<boolean> {
  try {
    const data = await lookup(baseItemId);
    return data.itemLevel === baseILevel;
  } catch {
    return false;
  }
}

export async function buildUpgradeBisIds(
  needs: GearNeeds,
  bis: BisGearSet,
  acquisitionMap: GearAcquisitionMap,
  lookup: (id: number) => Promise<{ itemLevel: number }> = fetchItemData,
): Promise<Set<number>> {
  const upgradeBisIds = new Set<number>();
  await Promise.all(needs.itemNeeds.map(async need => {
    const bisItem = bis.items[need.slot];
    if (bisItem?.itemLevel !== undefined) {
      if (acquisitionMap.upgradeILevel && bisItem.itemLevel === acquisitionMap.upgradeILevel) {
        upgradeBisIds.add(need.bisItemId);
      }
    } else {
      const baseId = getBaseItemId(need.bisItemId, acquisitionMap.upgradeOffset);
      if (baseId > 0) {
        if (await confirmUpgradeMatch(baseId, acquisitionMap.baseILevel, lookup)) {
          upgradeBisIds.add(need.bisItemId);
        }
      }
    }
  }));
  return upgradeBisIds;
}
