import type { GearSnapshot } from "../types.ts";
import { API_BASE, JOB_ABBREV_TO_CLASS_ID } from "./constants.ts";
import { setStatus, clearStatus, logger } from "./dom.ts";
import {
  currentSnapshot, currentItemDataMap, currentJobKey,
  snapshotMeta, bisLinkUrl,
  manualJobAbbrev, setManualJobAbbrev,
  cachedJobs,
} from "./state.ts";
import { fetchItemData, fetchJson } from "./api.ts";
import { autoDetectJob, selectJob, runComparison } from "./bis/comparison.ts";

// TODO: add a "lock job" toggle that prevents live pcap from overriding the manual
// selection. When locked, skip the setManualJobAbbrev(null) call below and keep
// selectJob(manualJobAbbrev.value) even when fromCache is false.

async function applySnapshot(snapshot: GearSnapshot, fromCache: boolean): Promise<void> {
  currentSnapshot.value = snapshot;

  const allIds = new Set<number>();
  for (const piece of Object.values(snapshot.items)) {
    if (piece?.itemId) allIds.add(piece.itemId);
    for (const mid of piece?.materias ?? []) {
      if (mid !== 0) allIds.add(mid);
    }
  }

  setStatus("Resolving item names...");
  const resolved = await Promise.all([...allIds].map(id => fetchItemData(id).then(d => [id, d] as [number, typeof d])));
  currentItemDataMap.value = new Map(resolved);

  clearStatus();
  if (snapshot.capturedAt) {
    const ts = new Date(snapshot.capturedAt).toLocaleString();
    snapshotMeta.value = fromCache ? `Cached · Last seen ${ts}` : `Live · Captured ${ts}`;
  }
}

export async function loadCachedJobs(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/pcap/gear-cache`);
    if (!res.ok) return;
    cachedJobs.value = await res.json() as typeof cachedJobs.value;
  } catch {
    // server may not be running yet; silently ignore
  }
}

export async function loadGearForClassId(classId: number, abbrev: string): Promise<void> {
  setStatus("Loading cached gear...");
  snapshotMeta.value = null;

  const result = await fetchJson<GearSnapshot & { fromCache?: boolean }>(`${API_BASE}/pcap/gear-cache/${classId}`);
  if (!result.ok) {
    setStatus(`No cached gear for ${abbrev}`, true);
    return;
  }
  await applySnapshot(result.data, true);

  // Tell the server which snapshot to compare against so that /compare,
  // /needs, and /acquisition use this job's gear instead of the latest pcap.
  void fetch(`${API_BASE}/pcap/gear-selected`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result.data),
  }).catch(err => logger.warn(err, "[app] failed to set selected gear"));

  setManualJobAbbrev(abbrev);
  // Reset currentJobKey so selectJob always re-runs catalog filtering for the new job.
  currentJobKey.value = null;
  await selectJob(abbrev);
  if (bisLinkUrl.value) await runComparison();
}

export async function loadGear(): Promise<void> {
  logger.debug("[app] loadGear called");
  snapshotMeta.value = null;
  setStatus("Fetching gear from packet capture...");

  const result = await fetchJson<GearSnapshot & { fromCache?: boolean }>(`${API_BASE}/pcap/gear`);
  if (!result.ok) {
    setStatus(result.error, true);
    return;
  }
  logger.debug({ slots: Object.keys(result.data.items) }, "[app] snapshot received");

  const fromCache = result.data.fromCache ?? false;
  await applySnapshot(result.data, fromCache);

  if (!fromCache) {
    // Live data just arrived — the per-job cache was just written on the server.
    // Refresh the available jobs list so the dropdown reflects the new entry.
    setManualJobAbbrev(null);
    await loadCachedJobs();
    await autoDetectJob(currentItemDataMap.value);
  } else if (manualJobAbbrev.value) {
    // gear.json may belong to a different job than the one the user had selected.
    // Load the job-specific cache so the gear display matches the dropdown.
    const classId = JOB_ABBREV_TO_CLASS_ID[manualJobAbbrev.value];
    if (classId !== undefined) {
      await loadGearForClassId(classId, manualJobAbbrev.value);
      return; // loadGearForClassId handles comparison
    }
    await autoDetectJob(currentItemDataMap.value);
  } else {
    await autoDetectJob(currentItemDataMap.value);
  }

  if (bisLinkUrl.value) await runComparison();
}
