import type { GearSnapshot } from "../types.ts";
import { API_BASE } from "./constants.ts";
import { setStatus, clearStatus, logger } from "./dom.ts";
import { state, snapshotMeta, bisLinkUrl } from "./state.ts";
import { fetchItemData } from "./api.ts";
import { autoDetectJob, runComparison } from "./bis/comparison.ts";

export async function loadGear(): Promise<void> {
  logger.debug("[app] loadGear called");
  snapshotMeta.value = null;
  setStatus("Fetching gear from packet capture...");

  let snapshot: GearSnapshot;
  try {
    const res = await fetch(`${API_BASE}/pcap/gear`);
    logger.debug(`[app] /pcap/gear → HTTP ${res.status}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      setStatus(data?.error ?? "Failed to load gear", true);
      return;
    }
    snapshot = await res.json() as GearSnapshot;
    logger.debug({ slots: Object.keys(snapshot.items) }, "[app] snapshot received");
  } catch (err) {
    logger.error(err, "[app] fetch /pcap/gear failed");
    setStatus("Could not reach the server — is it running?", true);
    return;
  }

  state.currentSnapshot = snapshot;

  const allIds = new Set<number>();
  for (const piece of Object.values(snapshot.items)) {
    if (piece?.itemId) allIds.add(piece.itemId);
    for (const mid of piece?.materias ?? []) {
      if (mid !== 0) allIds.add(mid);
    }
  }
  logger.debug({ ids: [...allIds] }, `[app] resolving ${allIds.size} item IDs`);

  setStatus("Resolving item names...");
  const resolved = await Promise.all([...allIds].map(id => fetchItemData(id).then(d => [id, d] as [number, typeof d])));
  state.currentItemDataMap = new Map(resolved);

  clearStatus();
  if (snapshot.capturedAt) {
    snapshotMeta.value = `Captured ${new Date(snapshot.capturedAt).toLocaleString()}`;
  }

  await autoDetectJob(state.currentItemDataMap);

  if (bisLinkUrl.value) await runComparison();
}
