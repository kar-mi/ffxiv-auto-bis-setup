import type { BisCatalog, LocalBisEntry } from "../../types.ts";
import { API_BASE } from "../constants.ts";
import { logger } from "../dom.ts";
import { state, bisLinkEntries, bisLinkVisible, bisLinkUrl, compareVisible } from "../state.ts";

export async function loadCatalog(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/bis/catalog`);
    if (res.ok) state.currentCatalog = await res.json() as BisCatalog;
  } catch {
    logger.warn("[app] could not load BIS catalog");
  }
}


export async function patchSet(id: string, patch: Partial<LocalBisEntry>): Promise<void> {
  await fetch(`${API_BASE}/bis/catalog/sets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
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
  if (setDefault && state.currentJobAbbrev) {
    await fetch(`${API_BASE}/bis/catalog/preferences/${encodeURIComponent(state.currentJobAbbrev)}`, {
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
  if (!state.currentJobAbbrev) return;
  const savedEntries = (state.currentCatalog?.sets ?? []).filter(e => e.set.job === state.currentJobAbbrev);
  const preferredId  = state.currentCatalog?.preferences?.[state.currentJobAbbrev] ?? null;
  const currentUrl   = bisLinkUrl.value;

  bisLinkEntries.value = savedEntries.map(e => ({
    url:   e.url,
    label: `${e.id === preferredId ? "★ " : ""}${e.set.name}`,
  }));
  bisLinkVisible.value = savedEntries.length > 0;

  if (currentUrl && savedEntries.some(e => e.url === currentUrl)) {
    bisLinkUrl.value = currentUrl;
  } else {
    bisLinkUrl.value     = "";
    compareVisible.value = false;
  }
}

// Replaced by <SavedSetsTab /> component in BisTab.tsx — signals drive re-renders.
export function renderSavedSetsTab(): void {}
