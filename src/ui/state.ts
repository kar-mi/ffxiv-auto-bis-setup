import { signal, computed } from "@preact/signals";
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

const _storedJob = typeof localStorage !== "undefined" ? (localStorage.getItem("ffxiv-manual-job") ?? null) : null;
export const manualJobAbbrev    = signal<string | null>(_storedJob);

export interface CachedJobEntry { classId: number; capturedAt: string }
export const cachedJobs         = signal<CachedJobEntry[]>([]);

export function setManualJobAbbrev(abbrev: string | null): void {
  manualJobAbbrev.value = abbrev;
  if (abbrev) localStorage.setItem("ffxiv-manual-job", abbrev);
  else localStorage.removeItem("ffxiv-manual-job");
}

// BIS link dropdown — driven by comparison/catalog, consumed by GearTabPanel
export const bisLinkEntries     = signal<{ url: string; label: string }[]>([]);
export const bisLinkUrl         = signal("");
export const bisLinkVisible     = computed(() => bisLinkEntries.value.length > 0);
export const compareVisible     = computed(() => bisLinkUrl.value !== "");
export const clearVisible       = computed(() => comparisonData.value !== null);

// Gear tab status elements — driven by dom.ts / gear-load.ts
export const snapshotMeta       = signal<string | null>(null);
export const statusMsg          = signal<string | null>(null);
export const statusIsError      = signal(false);

// Compatibility shim — non-component modules use `state.X` / `state.X = y` syntax.
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
};

export const mergedItemDataMap = computed(
  () => new Map([...currentItemDataMap.value, ...bisItemDataMap.value]),
);
