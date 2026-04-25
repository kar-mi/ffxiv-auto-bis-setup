import type { BisCatalog, LocalBisEntry, RaidTier } from "../../types.ts";
import { API_BASE, CORNERS } from "../constants.ts";
import { RAID_TIER_LABELS } from "../../types.ts";
import { el, logger } from "../dom.ts";
import { state } from "../state.ts";

export async function loadCatalog(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/bis/catalog`);
    if (res.ok) state.currentCatalog = await res.json() as BisCatalog;
  } catch {
    logger.warn("[app] could not load BIS catalog");
  }
}

export function tierSelectHtml(id: string, selected: string): string {
  const opts = (Object.entries(RAID_TIER_LABELS) as [RaidTier, string][]).map(([v, label]) =>
    `<option value="${v}"${v === selected ? " selected" : ""}>${label}</option>`,
  ).join("");
  return `<select id="${id}" class="bg-ffxiv-dark border border-ffxiv-border text-gray-200 text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-ffxiv-gold flex-1">${opts}</select>`;
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
  const sel = el("sel-bis-link") as HTMLSelectElement;
  const currentVal = sel.value;

  sel.innerHTML = `<option value="">— Select —</option>`;
  for (const entry of savedEntries) {
    const isDefault = entry.id === preferredId;
    const opt = document.createElement("option");
    opt.value = entry.url;
    opt.textContent = `${isDefault ? "★ " : ""}${entry.set.name}`;
    sel.appendChild(opt);
  }

  if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
    sel.value = currentVal;
  }
  el("bis-link-wrap").classList.toggle("hidden", savedEntries.length === 0);
}

export function renderSavedSetsTab(): void {
  const list = el("saved-sets-list");
  const allSets = state.currentCatalog?.sets ?? [];

  const filterSel = el("sel-bis-job-filter") as HTMLSelectElement;
  const prevFilter = filterSel.value;
  const jobs = [...new Set(allSets.map(e => e.set.job))].sort();
  filterSel.innerHTML = `<option value="">All Classes</option>` +
    jobs.map(j => `<option value="${j}"${j === prevFilter ? " selected" : ""}>${j}</option>`).join("");
  state.bisJobFilter = filterSel.value;

  if (allSets.length === 0) {
    list.innerHTML = `<p class="text-xs text-gray-500 italic">No sets saved yet. Use Paste URL or The Balance to add one.</p>`;
    return;
  }

  const visibleSets = state.bisJobFilter ? allSets.filter(e => e.set.job === state.bisJobFilter) : allSets;
  if (visibleSets.length === 0) {
    list.innerHTML = `<p class="text-xs text-gray-500 italic">No sets saved for this class.</p>`;
    return;
  }

  list.innerHTML = visibleSets.map(entry => {
    const isDefault = state.currentCatalog?.preferences?.[entry.set.job] === entry.id;
    const safeName = entry.set.name.replace(/"/g, "&quot;");
    return `
      <div class="relative flex flex-col gap-1.5 bg-ffxiv-dark border border-ffxiv-border rounded px-3 py-2" data-entry-id="${entry.id}">
        ${CORNERS}
        <div class="flex items-center gap-2">
          <div class="flex-1 min-w-0">
            <input class="inp-set-name text-xs text-gray-200 font-medium bg-ffxiv-dark border border-ffxiv-border rounded w-full px-1.5 py-0.5 focus:outline-none focus:border-ffxiv-gold/50 truncate"
                   value="${safeName}" data-id="${entry.id}" data-original="${safeName}" title="${entry.url}" />
          </div>
          <span class="text-[10px] text-gray-500 flex-shrink-0">${entry.set.job}</span>
          <button class="btn-set-default flex-shrink-0 text-[10px] px-1.5 py-0.5 border rounded transition-colors ${isDefault ? "text-ffxiv-gold border-ffxiv-gold/60" : "text-gray-500 border-ffxiv-border hover:text-ffxiv-gold hover:border-ffxiv-gold/60"}"
                  data-id="${entry.id}" data-job="${entry.set.job}" data-is-default="${isDefault}"
                  title="${isDefault ? "Clear default" : "Set as default"}">
            ${isDefault ? "★" : "☆"}
          </button>
          <button class="btn-delete-set flex-shrink-0 text-[10px] text-gray-500 hover:text-red-400 transition-colors border border-ffxiv-border hover:border-red-800 rounded px-1.5 py-0.5"
                  data-id="${entry.id}">
            Remove
          </button>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-gray-500 flex-shrink-0">Tier</span>
          ${tierSelectHtml(`tier-sel-${entry.id}`, entry.raidTier)}
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll<HTMLInputElement>(".inp-set-name").forEach(input => {
    input.addEventListener("blur", async () => {
      const name = input.value.trim();
      if (!name || name === input.dataset["original"]) return;
      await patchSet(input.dataset["id"]!, { set: { ...state.currentCatalog!.sets.find(e => e.id === input.dataset["id"])!.set, name } });
      input.dataset["original"] = name;
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = input.dataset["original"] ?? ""; input.blur(); }
    });
  });

  list.querySelectorAll<HTMLButtonElement>(".btn-set-default").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id  = btn.dataset["id"]!;
      const job = btn.dataset["job"]!;
      const isDefault = btn.dataset["isDefault"] === "true";
      if (isDefault) {
        await fetch(`${API_BASE}/bis/catalog/preferences/${encodeURIComponent(job)}`, { method: "DELETE" });
      } else {
        await fetch(`${API_BASE}/bis/catalog/preferences/${encodeURIComponent(job)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      }
      await loadCatalog();
      refreshBisDropdown();
      renderSavedSetsTab();
    });
  });

  list.querySelectorAll<HTMLButtonElement>(".btn-delete-set").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset["id"]!;
      btn.disabled = true;
      btn.textContent = "Removing...";
      await fetch(`${API_BASE}/bis/catalog/sets/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadCatalog();
      refreshBisDropdown();
      renderSavedSetsTab();
    });
  });

  list.querySelectorAll<HTMLSelectElement>(`[id^="tier-sel-"]`).forEach(sel => {
    const id = sel.id.replace("tier-sel-", "");
    sel.addEventListener("change", () => void patchSet(id, { raidTier: sel.value as RaidTier }));
  });
}
