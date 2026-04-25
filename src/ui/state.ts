import type { GearSnapshot, GearsetComparison, BisGearSet, BisCatalog } from "../types.ts";
import type { SlotAcquisitionStatus } from "../acquisition/types.ts";
import type { ItemData } from "../xivapi/item-data.ts";

export const state = {
  currentSnapshot:    null as GearSnapshot | null,
  currentItemDataMap: new Map<number, ItemData>(),
  comparisonData:     null as GearsetComparison | null,
  currentBisSet:      null as BisGearSet | null,
  bisItemDataMap:     new Map<number, ItemData>(),
  acquisitionData:    null as SlotAcquisitionStatus[] | null,
  currentJobKey:      null as string | null,
  currentJobAbbrev:   null as string | null,
  currentCatalog:     null as BisCatalog | null,
  bisJobFilter:       "",
  activeTab:          "gear",
};

export function mergedItemDataMap(): Map<number, ItemData> {
  return new Map([...state.currentItemDataMap, ...state.bisItemDataMap]);
}
