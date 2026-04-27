import type { GearsetComparison, BisGearSet } from "../../types.ts";
import type { SlotAcquisitionStatus } from "../../acquisition/types.ts";
import type { ItemData } from "../../xivapi/item-data.ts";
import { API_BASE, JOBS } from "../constants.ts";
import { setStatus, clearStatus, logger } from "../dom.ts";
import {
  state,
  bisLinkEntries, bisLinkVisible, bisLinkUrl,
  compareVisible, clearVisible,
} from "../state.ts";
import { fetchItemData } from "../api.ts";
import { renderGear, crystalJobName } from "../render/gear.ts";
import { renderAcquisitionPanel } from "../render/AcquisitionTab.tsx";
import { loadCatalog } from "./catalog.ts";

export async function runComparison(): Promise<void> {
  const url = bisLinkUrl.value;
  if (!url) return;

  setStatus("Comparing gear...");
  let compRes: Response, bisRes: Response, acqRes: Response;
  try {
    [compRes, bisRes, acqRes] = await Promise.all([
      fetch(`${API_BASE}/compare?url=${encodeURIComponent(url)}`),
      fetch(`${API_BASE}/bis?url=${encodeURIComponent(url)}`),
      fetch(`${API_BASE}/acquisition?url=${encodeURIComponent(url)}`),
    ]);
  } catch (err) {
    logger.error(err, "[app] comparison fetch failed");
    setStatus("Comparison request failed", true);
    return;
  }

  if (!compRes.ok) {
    const data = await compRes.json().catch(() => null) as { error?: string } | null;
    setStatus(data?.error ?? `Comparison failed (${compRes.status})`, true);
    return;
  }
  if (!bisRes.ok) {
    const data = await bisRes.json().catch(() => null) as { error?: string } | null;
    setStatus(data?.error ?? `BIS fetch failed (${bisRes.status})`, true);
    return;
  }

  state.comparisonData = await compRes.json() as GearsetComparison;
  state.currentBisSet  = await bisRes.json() as BisGearSet;

  if (acqRes.ok) {
    state.acquisitionData = await acqRes.json() as SlotAcquisitionStatus[];
    logger.debug({ count: state.acquisitionData.length }, "[app] acquisition data received");
  } else {
    const errBody = await acqRes.json().catch(() => null);
    logger.warn({ status: acqRes.status, body: errBody }, "[app] acquisition fetch failed");
    state.acquisitionData = null;
  }

  const bisIds = new Set<number>();
  for (const item of Object.values(state.currentBisSet.items)) {
    if (item?.itemId) bisIds.add(item.itemId);
    for (const mid of item?.materias ?? []) { if (mid) bisIds.add(mid); }
  }
  const resolvedBis = await Promise.all([...bisIds].map(id => fetchItemData(id).then(d => [id, d] as [number, ItemData])));
  state.bisItemDataMap = new Map(resolvedBis);

  clearStatus();
  clearVisible.value = true;
  renderGear();
  renderAcquisitionPanel();
}

export async function autoDetectJob(itemDataMap: Map<number, ItemData>): Promise<void> {
  const crystal = state.currentSnapshot?.items?.crystal;
  if (!crystal) return;
  const data = itemDataMap.get(crystal.itemId);
  if (!data?.name) return;

  const jobLabel = crystalJobName(data.name);
  const job = JOBS.find(j => j.label.toLowerCase() === jobLabel.toLowerCase());
  if (!job) return;

  state.currentJobAbbrev = job.abbrev;
  if (!state.currentCatalog) await loadCatalog();

  const jobKey = `${job.role}/${job.job}`;
  if (jobKey === state.currentJobKey) return;
  state.currentJobKey = jobKey;

  const savedEntries = (state.currentCatalog?.sets ?? []).filter(e => e.set.job === job.abbrev);
  const preferredId  = state.currentCatalog?.preferences?.[job.abbrev] ?? null;

  bisLinkEntries.value = savedEntries.map(e => ({
    url:   e.url,
    label: `${e.id === preferredId ? "★ " : ""}${e.set.name}`,
  }));
  bisLinkVisible.value  = savedEntries.length > 0;
  bisLinkUrl.value      = "";
  compareVisible.value  = false;

  if (savedEntries.length === 0) return;

  if (preferredId) {
    const entry = savedEntries.find(e => e.id === preferredId);
    if (entry) {
      bisLinkUrl.value     = entry.url;
      compareVisible.value = true;
      await runComparison();
      return;
    }
  }

  if (savedEntries.length === 1) {
    bisLinkUrl.value     = savedEntries[0]!.url;
    compareVisible.value = true;
  }
}

export function onBisLinkChange(): void {
  compareVisible.value = !!bisLinkUrl.value;
}

export function clearComparison(): void {
  state.comparisonData   = null;
  state.currentBisSet    = null;
  state.bisItemDataMap   = new Map();
  state.acquisitionData  = null;
  state.currentJobKey    = null;
  state.currentJobAbbrev = null;
  bisLinkEntries.value   = [];
  bisLinkVisible.value   = false;
  bisLinkUrl.value       = "";
  compareVisible.value   = false;
  clearVisible.value     = false;
  renderGear();
  renderAcquisitionPanel();
}
