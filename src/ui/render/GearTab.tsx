import { currentSnapshot, comparisonData, mergedItemDataMap } from "../state.ts";
import { SLOT_LABELS, LEFT_SLOTS, RIGHT_SLOTS } from "../constants.ts";
import { openCompareModal } from "./CompareModal.tsx";
import { Corners } from "../components/Corners.tsx";
import { MateriaCircles } from "../components/MateriaCircles.tsx";
import { ItemIcon } from "../components/ItemIcon.tsx";
import type { EquipmentPiece, SlotComparison } from "../../types.ts";
import type { ItemData } from "../../xivapi/item-data.ts";

function StatusDot({ status }: { status: string | null }) {
  if (!status || status === "bis-empty") return null;
  const colors: Record<string, string> = {
    "match":         "bg-green-500",
    "wrong-materia": "bg-yellow-400",
    "wrong-item":    "bg-red-500",
    "missing":       "bg-red-500",
  };
  return <span class={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${colors[status] ?? ""} flex-shrink-0`} />;
}

function GearCard({ slot, piece, itemDataMap, slotComp }: {
  slot: string;
  piece: EquipmentPiece | null;
  itemDataMap: Map<number, ItemData>;
  slotComp: SlotComparison | undefined;
}) {
  const label      = SLOT_LABELS[slot] ?? slot;
  const status     = slotComp?.status ?? null;
  const hasStatus  = status !== null && status !== "bis-empty";
  const isClickable = hasStatus && status !== "match";
  const hoverCls   = hasStatus ? "" : " hover:border-ffxiv-gold";
  const cursorCls  = isClickable ? " cursor-pointer" : "";

  if (!piece) {
    return (
      <div
        class={`gear-card relative flex items-start gap-2 bg-ffxiv-panel border border-ffxiv-border rounded p-2 opacity-40${cursorCls}`}
        onClick={isClickable ? () => openCompareModal(slot) : undefined}
      >
        <Corners />
        <StatusDot status={status} />
        <div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-0.5">{label}</p>
          <p class="text-xs font-medium text-gray-600 truncate italic">Empty</p>
          <p class="text-[10px] text-ffxiv-gold font-mono mt-0.5 invisible">iLvl 0</p>
        </div>
      </div>
    );
  }

  const data      = itemDataMap.get(piece.itemId);
  const name      = data?.name ?? `Item #${piece.itemId}`;
  const itemLevel = data?.itemLevel ?? "?";

  return (
    <div
      class={`gear-card relative flex items-start gap-2 bg-ffxiv-panel border border-ffxiv-border rounded p-2 transition-colors${hoverCls}${cursorCls}`}
      onClick={isClickable ? () => openCompareModal(slot) : undefined}
    >
      <Corners />
      <StatusDot status={status} />
      <ItemIcon src={data?.icon} className="flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p class="text-xs font-medium text-gray-100 truncate">
          {name}{piece.hq && <span class="text-[10px] text-ffxiv-gold align-middle"> HQ</span>}
        </p>
        <p class="text-[10px] text-ffxiv-gold font-mono mt-0.5">iLvl {itemLevel}</p>
        <MateriaCircles piece={piece} itemDataMap={itemDataMap} />
      </div>
    </div>
  );
}

function CrystalCard({ piece, itemDataMap }: { piece: EquipmentPiece | null; itemDataMap: Map<number, ItemData> }) {
  if (!piece) {
    return (
      <div class="gear-card relative w-20 h-20 bg-ffxiv-panel border border-ffxiv-border rounded flex flex-col items-center justify-center gap-1 opacity-40">
        <Corners />
        <div class="w-10 h-10 rounded bg-ffxiv-border" />
        <p class="text-[9px] text-gray-600 italic">None</p>
      </div>
    );
  }
  const data    = itemDataMap.get(piece.itemId);
  const jobName = data?.name ? data.name.replace(/^Soul of (?:the )?/i, "") : `Item #${piece.itemId}`;
  return (
    <div class="gear-card relative w-20 h-20 bg-ffxiv-panel border border-ffxiv-border rounded flex flex-col items-center justify-center gap-1 p-2 hover:border-ffxiv-gold transition-colors">
      <Corners />
      <ItemIcon src={data?.icon} />
      <p class="text-[9px] text-gray-300 font-medium text-center leading-tight">{jobName}</p>
    </div>
  );
}

export function GearTab() {
  const snapshot = currentSnapshot.value;

  if (!snapshot) {
    return (
      <p class="text-xs text-gray-500 italic">
        No gear data yet — click Refresh to load from packet capture.
      </p>
    );
  }

  const merged     = mergedItemDataMap.value;
  const slotCompMap: Record<string, SlotComparison> = {};
  for (const sc of comparisonData.value?.slots ?? []) {
    slotCompMap[sc.slot] = sc;
  }

  return (
    <div class="flex gap-3 items-start">
      <div class="flex-1 min-w-0 space-y-2">
        {LEFT_SLOTS.map((slot) => (
          <GearCard key={slot} slot={slot} piece={snapshot.items[slot] ?? null} itemDataMap={merged} slotComp={slotCompMap[slot]} />
        ))}
      </div>
      <div class="flex-shrink-0 flex items-center justify-center self-center">
        <CrystalCard piece={snapshot.items["crystal"] ?? null} itemDataMap={merged} />
      </div>
      <div class="flex-1 min-w-0 space-y-2">
        {RIGHT_SLOTS.map((slot) => (
          <GearCard key={slot} slot={slot} piece={snapshot.items[slot] ?? null} itemDataMap={merged} slotComp={slotCompMap[slot]} />
        ))}
      </div>
    </div>
  );
}
