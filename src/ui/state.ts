import { signal } from "@preact/signals";
import type { GearSnapshot, GearsetComparison, BisGearSet, BisCatalog, SlotName } from "../types.ts";
import type { SlotAcquisitionStatus } from "../acquisition/types.ts";
import type { ItemData } from "../xivapi/item-data.ts";

// Named signals — import these directly in Preact components for reactivity.
export const currentSnapshot    = signal<GearSnapshot | null>(null);
export const currentItemDataMap = signal(new Map<number, ItemData>());
export const comparisonData     = signal<GearsetComparison | null>(null);
export const currentBisSet      = signal<BisGearSet | null>(null);
export const bisItemDataMap     = signal(new Map<number, ItemData>());
export const acquisitionData    = signal<SlotAcquisitionStatus[] | null>(null);
export const currentJobKey      = signal<string | null>(null);
export const currentJobAbbrev   = signal<string | null>(null);
export const currentCatalog     = signal<BisCatalog | null>(null);
export const bisJobFilter       = signal("");
export const activeTab          = signal("gear");
export const selectedSlot       = signal<SlotName | null>(null);

// Compatibility shim — existing modules that use `state.X` / `state.X = y` need no changes.
export const state = {
  get currentSnapshot()         { return currentSnapshot.value; },
  set currentSnapshot(v)        { currentSnapshot.value = v; },
  get currentItemDataMap()      { return currentItemDataMap.value; },
  set currentItemDataMap(v)     { currentItemDataMap.value = v; },
  get comparisonData()          { return comparisonData.value; },
  set comparisonData(v)         { comparisonData.value = v; },
  get currentBisSet()           { return currentBisSet.value; },
  set currentBisSet(v)          { currentBisSet.value = v; },
  get bisItemDataMap()          { return bisItemDataMap.value; },
  set bisItemDataMap(v)         { bisItemDataMap.value = v; },
  get acquisitionData()         { return acquisitionData.value; },
  set acquisitionData(v)        { acquisitionData.value = v; },
  get currentJobKey()           { return currentJobKey.value; },
  set currentJobKey(v)          { currentJobKey.value = v; },
  get currentJobAbbrev()        { return currentJobAbbrev.value; },
  set currentJobAbbrev(v)       { currentJobAbbrev.value = v; },
  get currentCatalog()          { return currentCatalog.value; },
  set currentCatalog(v)         { currentCatalog.value = v; },
  get bisJobFilter()            { return bisJobFilter.value; },
  set bisJobFilter(v)           { bisJobFilter.value = v; },
  get activeTab()               { return activeTab.value; },
  set activeTab(v)              { activeTab.value = v; },
};

export function mergedItemDataMap(): Map<number, ItemData> {
  return new Map([...currentItemDataMap.value, ...bisItemDataMap.value]);
}
