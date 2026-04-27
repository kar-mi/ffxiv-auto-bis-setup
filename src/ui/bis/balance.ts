import type { BisLink, RaidTier } from "../../types.ts";
import { signal } from "@preact/signals";
import { API_BASE, JOBS } from "../constants.ts";
import { logger } from "../dom.ts";
import { currentJobAbbrev, currentCatalog } from "../state.ts";
import { addSetFromUrl } from "./catalog.ts";

export interface BalanceLink extends BisLink {
  saved: boolean;
  adding: boolean;
  addError: string | null;
}

export const balanceTier    = signal<RaidTier>("aac_hw");
export const balanceLoading = signal(false);
export const balanceLinks   = signal<BalanceLink[] | null>(null);
export const balanceError   = signal<string | null>(null);

export async function loadBalanceLinks(): Promise<void> {
  const abbrev = currentJobAbbrev.value;
  if (!abbrev) {
    balanceLinks.value = null;
    balanceError.value = "Load gear first to detect your job.";
    return;
  }
  const job = JOBS.find(j => j.abbrev === abbrev);
  if (!job) return;

  balanceLoading.value = true;
  balanceError.value   = null;
  balanceLinks.value   = null;

  try {
    const res = await fetch(`${API_BASE}/balance/${job.role}/${job.job}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const links = await res.json() as BisLink[];

    if (!links.length) {
      balanceError.value = `No sets found for ${job.label}.`;
      return;
    }

    const savedUrls = new Set((currentCatalog.value?.sets ?? []).map(e => e.url));
    balanceLinks.value = links.map(link => ({
      ...link,
      saved:    savedUrls.has(link.url),
      adding:   false,
      addError: null,
    }));
  } catch (err) {
    logger.error(err, "[balance] fetch failed");
    balanceError.value = `Failed to load: ${(err as Error)?.message ?? String(err)}`;
  } finally {
    balanceLoading.value = false;
  }
}

export async function addBalanceLink(url: string): Promise<void> {
  patchLink(url, { adding: true, addError: null });
  try {
    await addSetFromUrl(url, balanceTier.value, false);
    patchLink(url, { saved: true, adding: false });
  } catch (err) {
    logger.error(err, "[balance] add failed");
    patchLink(url, { adding: false, addError: (err as Error)?.message ?? String(err) });
  }
}

function patchLink(url: string, patch: Partial<BalanceLink>): void {
  balanceLinks.value = (balanceLinks.value ?? []).map(l =>
    l.url === url ? { ...l, ...patch } : l
  );
}
