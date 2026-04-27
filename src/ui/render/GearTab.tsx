import { currentSnapshot, comparisonData, mergedItemDataMap } from "../state.ts";
import { SLOT_LABELS, LEFT_SLOTS, RIGHT_SLOTS } from "../constants.ts";
import { openCompareModal } from "./CompareModal.tsx";
import { Corners } from "../components/Corners.tsx";
import type { EquipmentPiece, SlotComparison } from "../../types.ts";
import type { ItemData } from "../../xivapi/item-data.ts";

function MateriaCircles({ piece, itemDataMap }: { piece: EquipmentPiece; itemDataMap: Map<number, ItemData> }) {
  const totalSlots = piece.materiaSlots ?? (piece.canOvermeld ? 5 : 2);
  return (
    <div class="flex gap-1 items-center mt-1">
      {Array.from({ length: totalSlots }, (_, i) => {
        const id = piece.materias[i] ?? 0;
        const filled = id !== 0;
        const isOvermeld = i >= 2;
        const title = filled ? (itemDataMap.get(id)?.name ?? `Materia #${id}`) : undefined;
        if (!filled) {
          const border = isOvermeld ? "border-red-800" : "border-blue-800";
          return <span key={i} data-tooltip={title} class={`w-2.5 h-2.5 rounded-full border ${border} flex-shrink-0 inline-block`} />;
        }
        const bg = isOvermeld ? "bg-red-500" : "bg-blue-400";
        return <span key={i} data-tooltip={title} class={`w-2.5 h-2.5 rounded-full ${bg} flex-shrink-0 inline-block`} />;
      })}
    </div>
  );
}

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

function GearCard({ slot, piece, itemDataMap, slotComp, index }: {
  slot: string;
  piece: EquipmentPiece | null;
  itemDataMap: Map<number, ItemData>;
  slotComp: SlotComparison | undefined;
  index: number;
}) {
  const label      = SLOT_LABELS[slot] ?? slot;
  const status     = slotComp?.status ?? null;
  const hasStatus  = status !== null && status !== "bis-empty";
  const isClickable = hasStatus && status !== "match";
  const hoverCls   = hasStatus ? "" : " hover:border-ffxiv-gold";
  const cursorCls  = isClickable ? " cursor-pointer" : "";
  const delay      = { animationDelay: `${index * 40}ms` };

  if (!piece) {
    return (
      <div
        class={`gear-card relative flex items-start gap-2 bg-ffxiv-panel border border-ffxiv-border rounded p-2 opacity-40${cursorCls}`}
        style={delay}
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
      style={delay}
      onClick={isClickable ? () => openCompareModal(slot) : undefined}
    >
      <Corners />
      <StatusDot status={status} />
      {data?.icon
        ? <img src={data.icon} alt="" class="w-10 h-10 rounded flex-shrink-0 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        : <div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0" />
      }
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
      <div class="gear-card relative w-20 h-20 bg-ffxiv-panel border border-ffxiv-border rounded flex flex-col items-center justify-center gap-1 opacity-40" style={{ animationDelay: "120ms" }}>
        <Corners />
        <div class="w-10 h-10 rounded bg-ffxiv-border" />
        <p class="text-[9px] text-gray-600 italic">None</p>
      </div>
    );
  }
  const data    = itemDataMap.get(piece.itemId);
  const jobName = data?.name ? data.name.replace(/^Soul of (?:the )?/i, "") : `Item #${piece.itemId}`;
  return (
    <div class="gear-card relative w-20 h-20 bg-ffxiv-panel border border-ffxiv-border rounded flex flex-col items-center justify-center gap-1 p-2 hover:border-ffxiv-gold transition-colors" style={{ animationDelay: "120ms" }}>
      <Corners />
      {data?.icon
        ? <img src={data.icon} alt="" class="w-10 h-10 rounded object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        : <div class="w-10 h-10 rounded bg-ffxiv-border" />
      }
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

  const merged     = mergedItemDataMap();
  const slotCompMap: Record<string, SlotComparison> = {};
  for (const sc of comparisonData.value?.slots ?? []) {
    slotCompMap[sc.slot] = sc;
  }

  return (
    <div class="flex gap-3 items-start">
      <div class="flex-1 min-w-0 space-y-2">
        {LEFT_SLOTS.map((slot, i) => (
          <GearCard key={slot} slot={slot} piece={snapshot.items[slot] ?? null} itemDataMap={merged} slotComp={slotCompMap[slot]} index={i} />
        ))}
      </div>
      <div class="flex-shrink-0 flex items-center justify-center self-center">
        <CrystalCard piece={snapshot.items["crystal"] ?? null} itemDataMap={merged} />
      </div>
      <div class="flex-1 min-w-0 space-y-2">
        {RIGHT_SLOTS.map((slot, i) => (
          <GearCard key={slot} slot={slot} piece={snapshot.items[slot] ?? null} itemDataMap={merged} slotComp={slotCompMap[slot]} index={LEFT_SLOTS.length + i} />
        ))}
      </div>
    </div>
  );
}
