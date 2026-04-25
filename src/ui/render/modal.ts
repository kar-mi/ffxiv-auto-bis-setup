import type { EquipmentPiece, SlotComparison, SlotName } from "../../types.ts";
import type { SlotAcquisitionStatus, UpgradePathStatus } from "../../acquisition/types.ts";
import type { ItemData } from "../../xivapi/item-data.ts";
import { SLOT_LABELS, CORNERS } from "../constants.ts";
import { el } from "../dom.ts";
import { state, mergedItemDataMap } from "../state.ts";
import { renderMateria, renderMateriaCompare } from "./gear.ts";

function materiaSetDiff(
  equipped: number[],
  bis: number[],
): { toAdd: number[]; toRemove: number[] } {
  const count = (ids: number[]): Map<number, number> => {
    const m = new Map<number, number>();
    for (const id of ids) if (id !== 0) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  };
  const eq = count(equipped);
  const bm = count(bis);
  const toAdd: number[] = [];
  const toRemove: number[] = [];
  for (const [id, need] of bm) {
    const have = eq.get(id) ?? 0;
    for (let i = have; i < need; i++) toAdd.push(id);
  }
  for (const [id, have] of eq) {
    const need = bm.get(id) ?? 0;
    for (let i = need; i < have; i++) toRemove.push(id);
  }
  return { toAdd, toRemove };
}

function renderMateriaAdvice(slotComp: SlotComparison, itemDataMap: Map<number, ItemData>): string {
  const equipped = slotComp.equippedMaterias ?? [];
  const bis = slotComp.bisMaterias ?? [];
  const { toAdd, toRemove } = materiaSetDiff(equipped, bis);
  const parts: string[] = [];

  if (toRemove.length > 0) {
    parts.push(`<p class="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Remove</p>`);
    for (const id of toRemove) {
      const name = itemDataMap.get(id)?.name ?? `Materia #${id}`;
      parts.push(`<p class="text-xs text-red-400">&minus; ${name}</p>`);
    }
  }
  if (toAdd.length > 0) {
    if (toRemove.length > 0) parts.push(`<div class="h-2"></div>`);
    parts.push(`<p class="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Add</p>`);
    for (const id of toAdd) {
      const name = itemDataMap.get(id)?.name ?? `Materia #${id}`;
      parts.push(`<p class="text-xs text-green-400">+ ${name}</p>`);
    }
  }

  const bisCount = bis.filter(id => id !== 0).length;
  if (bisCount > 2) {
    const extra = bisCount - 2;
    parts.push(`<p class="text-[10px] text-yellow-600 mt-2">${extra} overmeld slot${extra !== 1 ? "s" : ""} required &mdash; success is not guaranteed.</p>`);
  }

  return parts.join("");
}

function adviceBlock(label: string, ready: boolean, html: string): string {
  const labelColor = ready ? "text-green-400" : "text-gray-500";
  return `
    <div>
      <p class="text-[10px] ${labelColor} uppercase tracking-wide font-semibold mb-1">${label}</p>
      <p class="text-xs text-gray-300 leading-relaxed">${html}</p>
    </div>`;
}

function renderAcquisitionAdvice(
  s: Pick<SlotAcquisitionStatus, "coffer" | "books" | "upgrade">,
  itemDataMap: Map<number, ItemData>,
): string {
  const name = (id: number): string | undefined => itemDataMap.get(id)?.name;
  const sections: string[] = [];

  if (s.coffer) {
    const { coffer, available } = s.coffer;
    const cofferName = name(coffer.itemId) ?? coffer.name;
    sections.push(adviceBlock(
      "Coffer", available,
      available
        ? `You have the <strong>${cofferName}</strong> in your bags — open it to get this piece.`
        : `Need the <strong>${cofferName}</strong>. Drops from savage raid.`,
    ));
  }

  if (s.books) {
    const { book, available } = s.books;
    const bookName = name(book.itemId) ?? book.name;
    sections.push(adviceBlock(
      "Books", available,
      available
        ? `Trade ${book.need}&times; <strong>${bookName}</strong> at the vendor (you have ${book.have}).`
        : `Need ${book.need}&times; <strong>${bookName}</strong> to buy the raid piece (have ${book.have}).`,
    ));
  }

  if (s.upgrade) {
    const { base, material, available } = s.upgrade as UpgradePathStatus;
    const tomeName = name(base.tomes.itemId)             ?? base.tomes.name;
    const matName  = name(material.material.itemId)      ?? material.material.name;
    const bookName = name(material.bookCost.book.itemId) ?? material.bookCost.book.name;

    let detail = "";
    if (base.haveBase) {
      detail += `You have the 780 base piece. `;
    } else if (base.canBuyWithTomes) {
      detail += `Buy the 780 base with <strong>${base.tomes.need} ${tomeName}</strong> (have ${base.tomes.have}). `;
    } else {
      detail += `Need <strong>${base.tomes.need} ${tomeName}</strong> for the 780 base (have ${base.tomes.have}). `;
    }

    if (material.available) {
      detail += `<strong>${matName}</strong> is in your bags &mdash; ready to upgrade at the vendor.`;
    } else if (material.bookCost.available) {
      const bc = material.bookCost;
      detail += `Trade ${bc.book.need}&times; <strong>${bookName}</strong> for <strong>${matName}</strong> (have ${bc.book.have}).`;
    } else {
      const bc = material.bookCost;
      detail += `Need <strong>${matName}</strong> &mdash; costs ${bc.book.need}&times; <strong>${bookName}</strong> (have ${bc.book.have}).`;
    }

    sections.push(adviceBlock("Upgrade", available, detail));
  }

  return sections.length > 0
    ? sections.join("")
    : `<p class="text-xs text-gray-500 italic">No acquisition data for this slot yet.</p>`;
}

function renderModalItemColumn(
  heading: string,
  piece: EquipmentPiece | null,
  bisItem: EquipmentPiece | null,
  itemDataMap: Map<number, ItemData>,
  status: string,
): string {
  const isBis = heading === "BIS";
  const data = piece ? itemDataMap.get(piece.itemId) : null;
  const name = data?.name ?? (piece ? `Item #${piece.itemId}` : "—");
  const itemLevel = data?.itemLevel ?? "?";
  const icon = data?.icon
    ? `<img src="${data.icon}" alt="" class="w-10 h-10 rounded object-cover flex-shrink-0" onerror="this.style.display='none'">`
    : `<div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0"></div>`;

  const itemNameColor = status === "wrong-item"
    ? (isBis ? "text-green-400" : "text-red-400")
    : "text-gray-100";

  let materiaHtml = "";
  if (piece) {
    materiaHtml = status === "wrong-materia"
      ? renderMateriaCompare(piece, bisItem, itemDataMap)
      : renderMateria(piece, itemDataMap);
  }

  return `
    <div class="flex-1 min-w-0">
      <p class="text-[10px] text-gray-500 uppercase tracking-wide mb-2">${heading}</p>
      <div class="relative flex items-start gap-2 bg-ffxiv-dark border border-ffxiv-border rounded p-2">
        ${CORNERS}
        ${icon}
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium ${itemNameColor} truncate">${name}</p>
          ${piece ? `<p class="text-[10px] text-ffxiv-gold font-mono mt-0.5">iLvl ${itemLevel}</p>` : ""}
          ${!piece ? `<p class="text-xs text-gray-500 italic">Empty</p>` : ""}
          ${materiaHtml}
        </div>
      </div>
    </div>`;
}

export function openCompareModal(slot: string): void {
  if (!state.comparisonData || !state.currentBisSet) return;
  const slotComp = state.comparisonData.slots.find(s => s.slot === slot);
  if (!slotComp || slotComp.status === "match" || slotComp.status === "bis-empty") return;

  const slotKey = slot as SlotName;
  const equipped  = state.currentSnapshot?.items[slotKey] ?? null;
  const bisItemRaw = state.currentBisSet.items[slotKey] ?? null;
  const merged = mergedItemDataMap();

  const bisPiece: EquipmentPiece | null = bisItemRaw
    ? { itemId: bisItemRaw.itemId, materias: bisItemRaw.materias, hq: false, canOvermeld: false, materiaSlots: 0 }
    : null;

  el("modal-slot-title").textContent = SLOT_LABELS[slot] ?? slot;
  el("modal-body").innerHTML = `
    ${renderModalItemColumn("Equipped", equipped ?? null, bisPiece, merged, slotComp.status)}
    <div class="w-px bg-ffxiv-border flex-shrink-0"></div>
    ${renderModalItemColumn("BIS", bisPiece, equipped ?? null, merged, slotComp.status)}
  `;

  const acqEl = el("modal-acquisition");
  if (slotComp.status === "wrong-materia") {
    acqEl.innerHTML = renderMateriaAdvice(slotComp, merged);
  } else {
    const slotAcq = state.acquisitionData?.find(s => s.slot === slot) ?? null;
    acqEl.innerHTML = renderAcquisitionAdvice(
      slotAcq ?? { coffer: null, books: null, upgrade: null },
      merged,
    );
  }
  acqEl.classList.remove("hidden");

  el("compare-modal").classList.remove("hidden");
}

export function closeModal(): void {
  el("compare-modal").classList.add("hidden");
}
