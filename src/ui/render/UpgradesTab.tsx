import { signal } from "@preact/signals";
import type { UpgradeItemsResponse, UpgradeItemEntry, UpgradeBaseGearEntry } from "../types.ts";
import { API_BASE, SLOT_LABELS } from "../constants.ts";
import { bisLinkUrl } from "../state.ts";
import { fetchJson } from "../api.ts";
import { Corners } from "../components/Corners.tsx";
import { ItemIcon } from "../components/ItemIcon.tsx";

type Status = "idle" | "loading" | "error";

const upgradeData      = signal<UpgradeItemsResponse | null>(null);
const upgradeStatus    = signal<Status>("idle");
const upgradeErrorMsg  = signal("");

const CATEGORIES: { key: keyof Omit<UpgradeItemsResponse, "baseGear">; label: string }[] = [
  { key: "currency",  label: "Currency"  },
  { key: "coffers",   label: "Coffers"   },
  { key: "materials", label: "Materials" },
  { key: "materia",   label: "Materia"   },
  { key: "books",     label: "Books"     },
];

export async function loadUpgradeItems(): Promise<void> {
  upgradeStatus.value = "loading";
  const bisUrl = bisLinkUrl.value;
  const endpoint = bisUrl
    ? `${API_BASE}/upgrade-items?url=${encodeURIComponent(bisUrl)}`
    : `${API_BASE}/upgrade-items`;
  const result = await fetchJson<UpgradeItemsResponse>(endpoint);
  if (!result.ok) {
    upgradeErrorMsg.value = result.error;
    upgradeStatus.value   = "error";
    return;
  }
  upgradeData.value   = result.data;
  upgradeStatus.value = "idle";
}


function GridCell({ item }: { item: UpgradeItemEntry }) {
  const have = item.have > 0;
  const dim  = have ? "" : " opacity-60";
  return (
    <div
      class={`relative flex flex-col items-center gap-1.5 bg-ffxiv-panel border ${have ? "border-ffxiv-border hover:border-ffxiv-gold" : "border-ffxiv-border hover:border-gray-500"} rounded p-2 transition-colors cursor-default`}
      data-tooltip={item.name ?? `Item #${item.itemId}`}
    >
      <Corners />
      <ItemIcon src={item.icon} className={dim} />
      <span class={`text-[11px] font-mono${have ? " text-green-400" : " text-gray-500 opacity-60"}`}>
        &times;{item.have}
      </span>
    </div>
  );
}

function BaseGearCell({ entry }: { entry: UpgradeBaseGearEntry }) {
  const label = SLOT_LABELS[entry.slot] ?? entry.slot;
  const owned = entry.haveEquipped || entry.haveInBags > 0 || entry.haveInArmory > 0;

  let statusLabel: string;
  let statusClass: string;
  if (entry.haveEquipped) {
    statusLabel = "Equipped";
    statusClass = "text-ffxiv-gold";
  } else if (entry.haveInArmory > 0) {
    statusLabel = "Armory";
    statusClass = "text-green-400";
  } else if (entry.haveInBags > 0) {
    statusLabel = "In Bags";
    statusClass = "text-green-400";
  } else {
    statusLabel = "Missing";
    statusClass = "text-gray-500 opacity-60";
  }

  return (
    <div
      class={`relative flex flex-col items-center gap-1.5 bg-ffxiv-panel border ${owned ? "border-ffxiv-border hover:border-ffxiv-gold" : "border-ffxiv-border hover:border-gray-500"} rounded p-2 transition-colors cursor-default`}
      data-tooltip={`${label}: ${entry.name}`}
    >
      <Corners />
      <ItemIcon src={entry.icon} className={owned ? "" : "opacity-60"} />
      <span class="text-[10px] text-gray-400 truncate w-full text-center">{label}</span>
      <span class={`text-[11px] font-mono ${statusClass}`}>{statusLabel}</span>
    </div>
  );
}

export function UpgradesTab() {
  const status = upgradeStatus.value;
  const data   = upgradeData.value;

  if (status === "loading") {
    return <p class="text-xs text-gray-500 italic">Loading...</p>;
  }
  if (status === "error") {
    return <p class="text-xs text-red-400">{upgradeErrorMsg.value}</p>;
  }
  if (!data) {
    return <p class="text-xs text-gray-500 italic">No data yet — load gear and run a BIS comparison first.</p>;
  }

  const sections = CATEGORIES.filter(({ key }) => (data[key]?.length ?? 0) > 0);
  const hasBaseGear = data.baseGear && data.baseGear.length > 0;

  if (sections.length === 0 && !hasBaseGear) {
    return <p class="text-xs text-gray-500 italic">No upgrade items found for the active raid tier.</p>;
  }

  return (
    <>
      {hasBaseGear && (
        <div class="mb-5">
          <h3 class="font-cinzel text-xs font-semibold text-ffxiv-gold uppercase tracking-wide mb-2">Pre-upgrade Gear</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
            {data.baseGear!.map(entry => <BaseGearCell key={entry.slot} entry={entry} />)}
          </div>
        </div>
      )}
      {sections.map(({ key, label }) => (
        <div class="mb-5" key={key}>
          <h3 class="font-cinzel text-xs font-semibold text-ffxiv-gold uppercase tracking-wide mb-2">{label}</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
            {data[key]!.map(item => <GridCell key={item.itemId} item={item} />)}
          </div>
        </div>
      ))}
    </>
  );
}
