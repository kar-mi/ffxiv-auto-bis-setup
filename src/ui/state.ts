import { signal, computed } from "@preact/signals";
import type { GearSnapshot, GearsetComparison, GearNeeds, BisGearSet, BisCatalog, SlotName } from "../types.ts";
import type { SlotAcquisitionStatus } from "../acquisition/types.ts";
import type { ItemData } from "../xivapi/item-data.ts";
import type { PcapStatus } from "../pcap/status.ts";

// Named signals — import these directly in Preact components for reactivity.
export const currentSnapshot    = signal<GearSnapshot | null>(null);
export const currentItemDataMap = signal(new Map<number, ItemData>());
export const comparisonData     = signal<GearsetComparison | null>(null);
export const needsData          = signal<GearNeeds | null>(null);
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
export const pcapStatus         = signal<PcapStatus | null>(null);
export const pcapWarningModalMsg = signal<string | null>(null);


export interface MateriaStatEntry { stat: string; value: number }
export const materiaStatsMap    = signal<Map<number, MateriaStatEntry>>(new Map());

export const mergedItemDataMap = computed(
  () => new Map([...currentItemDataMap.value, ...bisItemDataMap.value]),
);
