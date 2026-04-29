import type { BisCatalog, LocalBisEntry, RaidTier } from "../../types.ts";
import { API_BASE } from "../constants.ts";
import { logger } from "../dom.ts";
import { currentCatalog, currentJobAbbrev, bisLinkEntries, bisLinkUrl } from "../state.ts";

interface PatchSetRequest {
  name?: string;
  raidTier?: RaidTier;
}

export async function loadCatalog(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/bis/catalog`);
    if (res.ok) currentCatalog.value = await res.json() as BisCatalog;
  } catch {
    logger.warn("[app] could not load BIS catalog");
  }
}


export async function patchSet(id: string, patch: PatchSetRequest): Promise<void> {
  const res = await fetch(`${API_BASE}/bis/catalog/sets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  await loadCatalog();
  refreshBisDropdown();
}

export async function addSetFromUrl(url: string, raidTier: string, setDefault: boolean): Promise<LocalBisEntry> {
  const res = await fetch(`${API_BASE}/bis/catalog/sets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, raidTier }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  const entry = await res.json() as LocalBisEntry;
  if (setDefault && currentJobAbbrev.value) {
    await fetch(`${API_BASE}/bis/catalog/preferences/${encodeURIComponent(currentJobAbbrev.value)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id }),
    });
  }
  await loadCatalog();
  refreshBisDropdown();
  return entry;
}

export function refreshBisDropdown(): void {
  if (!currentJobAbbrev.value) return;
  const savedEntries = (currentCatalog.value?.sets ?? []).filter(e => e.set.job === currentJobAbbrev.value);
  const preferredId  = currentCatalog.value?.preferences?.[currentJobAbbrev.value] ?? null;
  const currentUrl   = bisLinkUrl.value;

  bisLinkEntries.value = savedEntries.map(e => ({
    url:   e.url,
    label: `${e.id === preferredId ? "★ " : ""}${e.set.name}`,
  }));

  bisLinkUrl.value = (currentUrl && savedEntries.some(e => e.url === currentUrl)) ? currentUrl : "";
}
