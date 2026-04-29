import { signal } from "@preact/signals";
import type { LocalBisEntry, RaidTier } from "../../types.ts";
import { RAID_TIER_LABELS } from "../../types.ts";
import { API_BASE } from "../constants.ts";
import { currentCatalog, bisJobFilter } from "../state.ts";
import { Corners } from "../components/Corners.tsx";
import { loadCatalog, patchSet, refreshBisDropdown } from "../bis/catalog.ts";

const deletingId   = signal<string | null>(null);
const pendingNames = signal<Record<string, string>>({});

function TierSelect({ entry }: { entry: LocalBisEntry }) {
  return (
    <select
      value={entry.raidTier}
      class="bg-ffxiv-dark border border-ffxiv-border text-gray-200 text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-ffxiv-gold flex-1"
      onChange={(e) => void patchSet(entry.id, { raidTier: (e.currentTarget as HTMLSelectElement).value as RaidTier })}
    >
      {(Object.entries(RAID_TIER_LABELS) as [RaidTier, string][]).map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

function SetRow({ entry }: { entry: LocalBisEntry }) {
  const isDefault  = currentCatalog.value?.preferences?.[entry.set.job] === entry.id;
  const isDeleting = deletingId.value === entry.id;
  const pendingName = pendingNames.value[entry.id];
  const isDirty = pendingName !== undefined && pendingName !== entry.set.name;

  function clearPending(): void {
    const next = { ...pendingNames.value };
    delete next[entry.id];
    pendingNames.value = next;
  }

  async function saveName(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed === entry.set.name) { clearPending(); return; }
    const setEntry = currentCatalog.value?.sets.find(s => s.id === entry.id);
    if (setEntry) {
      await patchSet(entry.id, { set: { ...setEntry.set, name: trimmed } });
      clearPending();
    }
  }

  return (
    <div class="relative flex flex-col gap-1.5 bg-ffxiv-dark border border-ffxiv-border rounded px-3 py-2" data-entry-id={entry.id}>
      <Corners />
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0">
          <input
            class="text-xs text-gray-200 font-medium bg-ffxiv-dark border border-ffxiv-border rounded w-full px-1.5 py-0.5 focus:outline-none focus:border-ffxiv-gold/50 truncate"
            value={pendingName ?? entry.set.name}
            data-id={entry.id}
            title={entry.url}
            onInput={(e) => {
              pendingNames.value = { ...pendingNames.value, [entry.id]: (e.currentTarget as HTMLInputElement).value };
            }}
            onKeyDown={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              if (e.key === "Enter")  { e.preventDefault(); void saveName(input.value); input.blur(); }
              if (e.key === "Escape") { clearPending(); input.blur(); }
            }}
          />
        </div>
        {isDirty && (
          <button
            class="flex-shrink-0 text-[10px] px-1.5 py-0.5 border border-ffxiv-gold/60 rounded text-ffxiv-gold hover:bg-ffxiv-gold/10 transition-colors"
            onClick={() => void saveName(pendingName!)}
          >
            Save
          </button>
        )}
        <span class="text-[10px] text-gray-500 flex-shrink-0">{entry.set.job}</span>
        <button
          class={`flex-shrink-0 text-[10px] px-1.5 py-0.5 border rounded transition-colors ${isDefault ? "text-ffxiv-gold border-ffxiv-gold/60" : "text-gray-500 border-ffxiv-border hover:text-ffxiv-gold hover:border-ffxiv-gold/60"}`}
          title={isDefault ? "Clear default" : "Set as default"}
          onClick={() => void (async () => {
            if (isDefault) {
              await fetch(`${API_BASE}/bis/catalog/preferences/${encodeURIComponent(entry.set.job)}`, { method: "DELETE" });
            } else {
              await fetch(`${API_BASE}/bis/catalog/preferences/${encodeURIComponent(entry.set.job)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: entry.id }),
              });
            }
            await loadCatalog();
            refreshBisDropdown();
          })()}
        >
          {isDefault ? "★" : "☆"}
        </button>
        <button
          class="flex-shrink-0 text-[10px] text-gray-500 hover:text-red-400 transition-colors border border-ffxiv-border hover:border-red-800 rounded px-1.5 py-0.5 disabled:opacity-50"
          disabled={isDeleting}
          onClick={() => void (async () => {
            deletingId.value = entry.id;
            await fetch(`${API_BASE}/bis/catalog/sets/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
            await loadCatalog();
            refreshBisDropdown();
            deletingId.value = null;
          })()}
        >
          {isDeleting ? "Removing..." : "Remove"}
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-gray-500 flex-shrink-0">Tier</span>
        <TierSelect entry={entry} />
      </div>
    </div>
  );
}

export function SavedSetsTab() {
  const catalog    = currentCatalog.value;
  const allSets    = catalog?.sets ?? [];
  const filter     = bisJobFilter.value;
  const jobs       = [...new Set(allSets.map(e => e.set.job))].sort();
  const visibleSets = filter ? allSets.filter(e => e.set.job === filter) : allSets;

  return (
    <>
      <div class="flex items-center gap-2">
        <label class="text-[10px] text-gray-500 uppercase tracking-wide flex-shrink-0">Class</label>
        <select
          id="sel-bis-job-filter"
          value={filter}
          class="bg-ffxiv-dark border border-ffxiv-border text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-ffxiv-gold flex-1"
          onChange={(e) => { bisJobFilter.value = (e.currentTarget as HTMLSelectElement).value; }}
        >
          <option value="">All Classes</option>
          {jobs.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>
      <div class="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto">
        {allSets.length === 0
          ? <p class="text-xs text-gray-500 italic">No sets saved yet. Use Paste URL or The Balance to add one.</p>
          : visibleSets.length === 0
            ? <p class="text-xs text-gray-500 italic">No sets saved for this class.</p>
            : visibleSets.map(entry => <SetRow key={entry.id} entry={entry} />)
        }
      </div>
    </>
  );
}
