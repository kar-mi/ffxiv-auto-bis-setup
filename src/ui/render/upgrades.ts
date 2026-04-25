import type { UpgradeItemsResponse, UpgradeItemEntry } from "../types.ts";
import { API_BASE, CORNERS } from "../constants.ts";
import { el } from "../dom.ts";

const CATEGORIES: { key: keyof UpgradeItemsResponse; label: string }[] = [
  { key: "currency",  label: "Currency"  },
  { key: "coffers",   label: "Coffers"   },
  { key: "materials", label: "Materials" },
  { key: "books",     label: "Books"     },
];

function renderGridCell(item: UpgradeItemEntry): string {
  const displayName = item.name || `Item #${item.itemId}`;
  const haveColor   = item.have > 0 ? "text-green-400" : "text-gray-500";
  const borderColor = item.have > 0 ? "border-ffxiv-border hover:border-ffxiv-gold" : "border-ffxiv-border hover:border-gray-500";
  const dimClass    = item.have > 0 ? "" : "opacity-60";
  const imgHtml = item.icon
    ? `<img src="${item.icon}" alt="" class="w-10 h-10 rounded object-cover ${dimClass}" onerror="this.style.display='none'">`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border ${dimClass}"></div>`;
  return `
    <div class="relative flex flex-col items-center gap-1.5 bg-ffxiv-panel border ${borderColor} rounded p-2 transition-colors cursor-default" data-tooltip="${displayName}">
      ${CORNERS}
      ${imgHtml}
      <span class="text-[11px] font-mono ${haveColor} ${dimClass}">&times;${item.have}</span>
    </div>`;
}

export async function renderUpgradesTab(): Promise<void> {
  const content = el("upgrades-content");
  content.innerHTML = `<p class="text-xs text-gray-500 italic">Loading...</p>`;

  let upgradeItems: UpgradeItemsResponse;
  try {
    const res = await fetch(`${API_BASE}/upgrade-items`);
    if (!res.ok) {
      const err = await res.json().catch(() => null) as { error?: string } | null;
      content.innerHTML = `<p class="text-xs text-red-400">${err?.error ?? `Failed to load (${res.status})`}</p>`;
      return;
    }
    upgradeItems = await res.json() as UpgradeItemsResponse;
  } catch {
    content.innerHTML = `<p class="text-xs text-red-400">Could not reach the server.</p>`;
    return;
  }

  const sections = CATEGORIES.map(({ key, label }) => {
    const items = upgradeItems[key];
    if (items.length === 0) return "";
    return `
      <div class="mb-5">
        <h3 class="font-cinzel text-xs font-semibold text-ffxiv-gold uppercase tracking-wide mb-2">${label}</h3>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
          ${items.map(renderGridCell).join("")}
        </div>
      </div>`;
  }).join("");

  content.innerHTML = sections || `<p class="text-xs text-gray-500 italic">No upgrade items found for the active raid tier.</p>`;
}
