import { signal } from "@preact/signals";
import type { UpgradeItemsResponse, UpgradeItemEntry } from "../types.ts";
import { API_BASE } from "../constants.ts";
import { Corners } from "../components/Corners.tsx";

type Status = "idle" | "loading" | "error";

const upgradeData      = signal<UpgradeItemsResponse | null>(null);
const upgradeStatus    = signal<Status>("idle");
const upgradeErrorMsg  = signal("");

const CATEGORIES: { key: keyof UpgradeItemsResponse; label: string }[] = [
  { key: "currency",  label: "Currency"  },
  { key: "coffers",   label: "Coffers"   },
  { key: "materials", label: "Materials" },
  { key: "books",     label: "Books"     },
];

export async function loadUpgradeItems(): Promise<void> {
  upgradeStatus.value = "loading";
  try {
    const res = await fetch(`${API_BASE}/upgrade-items`);
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      upgradeErrorMsg.value = body?.error ?? `Failed to load (${res.status})`;
      upgradeStatus.value = "error";
      return;
    }
    upgradeData.value   = await res.json() as UpgradeItemsResponse;
    upgradeStatus.value = "idle";
  } catch {
    upgradeErrorMsg.value = "Could not reach the server.";
    upgradeStatus.value   = "error";
  }
}

// Backward-compat alias — tabs.ts, comparison.ts, main.tsx keep working unchanged.
export const renderUpgradesTab = loadUpgradeItems;

function GridCell({ item }: { item: UpgradeItemEntry }) {
  const have = item.have > 0;
  const dim  = have ? "" : " opacity-60";
  return (
    <div
      class={`relative flex flex-col items-center gap-1.5 bg-ffxiv-panel border ${have ? "border-ffxiv-border hover:border-ffxiv-gold" : "border-ffxiv-border hover:border-gray-500"} rounded p-2 transition-colors cursor-default`}
      data-tooltip={item.name ?? `Item #${item.itemId}`}
    >
      <Corners />
      {item.icon
        ? <img src={item.icon} alt="" class={`w-10 h-10 rounded object-cover${dim}`} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        : <div class={`w-10 h-10 rounded bg-ffxiv-border${dim}`} />
      }
      <span class={`text-[11px] font-mono${have ? " text-green-400" : " text-gray-500 opacity-60"}`}>
        &times;{item.have}
      </span>
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

  const sections = CATEGORIES.filter(({ key }) => data[key].length > 0);
  if (sections.length === 0) {
    return <p class="text-xs text-gray-500 italic">No upgrade items found for the active raid tier.</p>;
  }

  return (
    <>
      {sections.map(({ key, label }) => (
        <div class="mb-5" key={key}>
          <h3 class="font-cinzel text-xs font-semibold text-ffxiv-gold uppercase tracking-wide mb-2">{label}</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
            {data[key].map(item => <GridCell key={item.itemId} item={item} />)}
          </div>
        </div>
      ))}
    </>
  );
}
