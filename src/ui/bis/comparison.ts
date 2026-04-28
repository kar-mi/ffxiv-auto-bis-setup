import type { GearsetComparison, GearNeeds, BisGearSet } from "../../types.ts";
import type { SlotAcquisitionStatus } from "../../acquisition/types.ts";
import type { ItemData } from "../../xivapi/item-data.ts";

interface BisFullResponse {
  bisSet: BisGearSet;
  comparison: GearsetComparison;
  needs: GearNeeds;
  acquisition: SlotAcquisitionStatus[];
}
import { API_BASE, JOBS } from "../constants.ts";
import { setStatus, clearStatus, logger } from "../dom.ts";
import {
  comparisonData, needsData, currentBisSet, bisItemDataMap, acquisitionData,
  currentSnapshot, currentJobKey, currentJobAbbrev, currentCatalog,
  bisLinkEntries, bisLinkUrl,
} from "../state.ts";
import { fetchItemData, fetchJson } from "../api.ts";
import { loadCatalog } from "./catalog.ts";

function crystalJobName(name: string): string {
  return name.replace(/^Soul of (?:the )?/i, "");
}

export async function runComparison(): Promise<void> {
  const url = bisLinkUrl.value;
  if (!url) return;

  setStatus("Comparing gear...");
  const result = await fetchJson<BisFullResponse>(`${API_BASE}/bis/full?url=${encodeURIComponent(url)}`);
  if (!result.ok) { setStatus(result.error, true); return; }

  const { bisSet, comparison, needs, acquisition } = result.data;
  comparisonData.value  = comparison;
  currentBisSet.value   = bisSet;
  needsData.value       = needs;
  acquisitionData.value = acquisition;
  logger.debug({ count: acquisition.length }, "[app] acquisition data received");

  const bisIds = new Set<number>();
  for (const item of Object.values(bisSet.items)) {
    if (item?.itemId) bisIds.add(item.itemId);
    for (const mid of item?.materias ?? []) { if (mid) bisIds.add(mid); }
  }
  const resolvedBis = await Promise.all([...bisIds].map(id => fetchItemData(id).then(d => [id, d] as [number, ItemData])));
  bisItemDataMap.value = new Map(resolvedBis);

  clearStatus();
}

export async function selectJob(abbrev: string): Promise<void> {
  const job = JOBS.find(j => j.abbrev === abbrev);
  if (!job) return;

  currentJobAbbrev.value = abbrev;
  if (!currentCatalog.value) await loadCatalog();

  const jobKey = `${job.role}/${job.job}`;
  if (jobKey === currentJobKey.value) return;
  currentJobKey.value = jobKey;

  const savedEntries = (currentCatalog.value?.sets ?? []).filter(e => e.set.job === abbrev);
  const preferredId  = currentCatalog.value?.preferences?.[abbrev] ?? null;

  bisLinkEntries.value = savedEntries.map(e => ({
    url:   e.url,
    label: `${e.id === preferredId ? "★ " : ""}${e.set.name}`,
  }));
  bisLinkUrl.value = "";

  if (savedEntries.length === 0) return;

  if (preferredId) {
    const entry = savedEntries.find(e => e.id === preferredId);
    if (entry) {
      bisLinkUrl.value = entry.url;
      await runComparison();
      return;
    }
  }

  if (savedEntries.length === 1) {
    bisLinkUrl.value = savedEntries[0]!.url;
  }
}

export async function autoDetectJob(itemDataMap: Map<number, ItemData>): Promise<void> {
  const crystal = currentSnapshot.value?.items?.crystal;
  if (!crystal) return;
  const data = itemDataMap.get(crystal.itemId);
  if (!data?.name) return;

  const jobLabel = crystalJobName(data.name);
  const job = JOBS.find(j => j.label.toLowerCase() === jobLabel.toLowerCase());
  if (!job) return;

  await selectJob(job.abbrev);
}

export function clearComparison(): void {
  comparisonData.value  = null;
  needsData.value       = null;
  currentBisSet.value   = null;
  bisItemDataMap.value  = new Map();
  acquisitionData.value = null;
  bisLinkEntries.value  = [];
  bisLinkUrl.value      = "";
  // Job selection intentionally kept so the picker stays populated after clearing.
  // currentJobKey is also cleared so the next selectJob call re-runs catalog filtering.
  currentJobKey.value   = null;
}
