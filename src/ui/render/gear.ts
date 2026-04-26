import type { EquipmentPiece, SlotComparison } from "../../types.ts";
import type { ItemData } from "../../xivapi/item-data.ts";
import { SLOT_LABELS, CORNERS } from "../constants.ts";

export function renderMateria(piece: EquipmentPiece, itemDataMap: Map<number, ItemData>): string {
  const totalSlots = piece.materiaSlots ?? (piece.canOvermeld ? 5 : 2);
  const circles = Array.from({ length: totalSlots }, (_, i) => {
    const id = piece.materias[i] ?? 0;
    const filled = id !== 0;
    const isOvermeld = i >= 2;
    const data = filled ? itemDataMap.get(id) : null;
    const title = data?.name ?? (filled ? `Materia #${id}` : "");
    const titleAttr = title ? ` data-tooltip="${title}"` : "";
    if (!filled) {
      const borderColor = isOvermeld ? "border-red-800" : "border-blue-800";
      return `<span${titleAttr} class="w-2.5 h-2.5 rounded-full border ${borderColor} flex-shrink-0 inline-block"></span>`;
    }
    const bgColor = isOvermeld ? "bg-red-500" : "bg-blue-400";
    return `<span${titleAttr} class="w-2.5 h-2.5 rounded-full ${bgColor} flex-shrink-0 inline-block"></span>`;
  });
  return `<div class="flex gap-1 items-center mt-1">${circles.join("")}</div>`;
}

export function renderMateriaCompare(
  piece: EquipmentPiece | null,
  bisItem: { materias: number[] } | null,
  itemDataMap: Map<number, ItemData>,
): string {
  const totalSlots = Math.max(
    piece?.materiaSlots ?? (piece?.canOvermeld ? 5 : 2),
    bisItem?.materias?.length ?? 0,
    2,
  );
  const circles = Array.from({ length: totalSlots }, (_, i) => {
    const equippedId = piece?.materias[i] ?? 0;
    const bisId = bisItem?.materias[i] ?? 0;
    const filled = equippedId !== 0;
    const isOvermeld = i >= 2;
    const matches = equippedId === bisId;
    const data = filled ? itemDataMap.get(equippedId) : null;
    const title = data?.name ?? (filled ? `Materia #${equippedId}` : "");
    const titleAttr = title ? ` data-tooltip="${title}"` : "";
    if (!filled) {
      const borderColor = isOvermeld ? "border-red-800" : "border-blue-800";
      return `<span${titleAttr} class="w-2.5 h-2.5 rounded-full border ${borderColor} flex-shrink-0 inline-block"></span>`;
    }
    const bgColor = matches ? "bg-blue-400" : (isOvermeld ? "bg-red-500" : "bg-yellow-500");
    return `<span${titleAttr} class="w-2.5 h-2.5 rounded-full ${bgColor} flex-shrink-0 inline-block"></span>`;
  });
  return `<div class="flex gap-1 items-center mt-1">${circles.join("")}</div>`;
}

export function crystalJobName(name: string): string {
  return name.replace(/^Soul of (?:the )?/i, "");
}

export function renderCrystal(piece: EquipmentPiece | null, itemDataMap: Map<number, ItemData>): string {
  if (!piece) {
    return `
      <div class="gear-card relative w-20 h-20 bg-ffxiv-panel border border-ffxiv-border rounded flex flex-col items-center justify-center gap-1 opacity-40" style="animation-delay:120ms">
        ${CORNERS}
        <div class="w-10 h-10 rounded bg-ffxiv-border"></div>
        <p class="text-[9px] text-gray-600 italic">None</p>
      </div>`;
  }
  const data = itemDataMap.get(piece.itemId);
  const jobName = data?.name ? crystalJobName(data.name) : `Item #${piece.itemId}`;
  const icon = data?.icon
    ? `<img src="${data.icon}" alt="" class="w-10 h-10 rounded object-cover"
         onerror="console.warn('[img] failed to load crystal icon:', this.src); this.style.display='none'">`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border"></div>`;
  return `
    <div class="gear-card relative w-20 h-20 bg-ffxiv-panel border border-ffxiv-border rounded flex flex-col items-center justify-center gap-1 p-2 hover:border-ffxiv-gold transition-colors" style="animation-delay:120ms">
      ${CORNERS}
      ${icon}
      <p class="text-[9px] text-gray-300 font-medium text-center leading-tight">${jobName}</p>
    </div>`;
}

function statusDot(status: string | null): string {
  if (!status || status === "bis-empty") return "";
  const colors: Record<string, string> = {
    "match":         "bg-green-500",
    "wrong-materia": "bg-yellow-400",
    "wrong-item":    "bg-red-500",
    "missing":       "bg-red-500",
  };
  return `<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${colors[status] ?? ""} flex-shrink-0"></span>`;
}

export function renderGearItem(
  slot: string,
  piece: EquipmentPiece | null,
  itemDataMap: Map<number, ItemData>,
  slotComp: SlotComparison | undefined,
  index = 0,
): string {
  const label = SLOT_LABELS[slot] ?? slot;
  const status = slotComp?.status ?? null;
  const hasStatus = status !== null && status !== "bis-empty";
  const isClickable = hasStatus && status !== "match";
  const hoverClass = hasStatus ? "" : "hover:border-ffxiv-gold";
  const dot = statusDot(status);
  const statusAttr = hasStatus ? `data-status="${status}"` : "";
  const clickAttr = isClickable ? `data-slot="${slot}"` : "";
  const animDelay = `animation-delay:${index * 40}ms`;

  if (!piece) {
    return `
      <div class="gear-card relative flex items-start gap-2 bg-ffxiv-panel border border-ffxiv-border rounded p-2 opacity-40${isClickable ? " cursor-pointer" : ""}"
           ${clickAttr} ${statusAttr} style="${animDelay}">
        ${CORNERS}${dot}
        <div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-0.5">${label}</p>
          <p class="text-xs font-medium text-gray-600 truncate italic">Empty</p>
          <p class="text-[10px] text-ffxiv-gold font-mono mt-0.5 invisible">iLvl 0</p>
          <div class="flex gap-1 items-center mt-1 invisible">
            <span class="w-2.5 h-2.5 rounded-full border border-blue-800 flex-shrink-0 inline-block"></span>
            <span class="w-2.5 h-2.5 rounded-full border border-blue-800 flex-shrink-0 inline-block"></span>
          </div>
        </div>
      </div>`;
  }

  const data = itemDataMap.get(piece.itemId);
  const name = data?.name ?? `Item #${piece.itemId}`;
  const itemLevel = data?.itemLevel ?? "?";
  const icon = data?.icon
    ? `<img src="${data.icon}" alt="" class="w-10 h-10 rounded flex-shrink-0 object-cover"
         onerror="console.warn('[img] failed to load icon for item ${piece.itemId}:', this.src); this.style.display='none'">`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>`;
  const hq = piece.hq ? ` <span class="text-[10px] text-ffxiv-gold align-middle">HQ</span>` : "";

  return `
    <div class="gear-card relative flex items-start gap-2 bg-ffxiv-panel border border-ffxiv-border rounded p-2 transition-colors ${hoverClass}${isClickable ? " cursor-pointer" : ""}"
         ${clickAttr} ${statusAttr} style="${animDelay}">
      ${CORNERS}${dot}
      ${icon}
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-gray-500 uppercase tracking-wide leading-none mb-0.5">${label}</p>
        <p class="text-xs font-medium text-gray-100 truncate">${name}${hq}</p>
        <p class="text-[10px] text-ffxiv-gold font-mono mt-0.5">iLvl ${itemLevel}</p>
        ${renderMateria(piece, itemDataMap)}
      </div>
    </div>`;
}

// Replaced by <GearTab /> component in GearTab.tsx — signals drive re-renders.
export function renderGear(): void {}
