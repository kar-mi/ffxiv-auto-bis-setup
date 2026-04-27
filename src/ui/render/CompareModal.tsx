import type { EquipmentPiece, SlotComparison, SlotName } from "../../types.ts";
import type { SlotAcquisitionStatus, UpgradePathStatus } from "../../acquisition/types.ts";
import type { ItemData } from "../../xivapi/item-data.ts";
import { SLOT_LABELS } from "../constants.ts";
import {
  selectedSlot, comparisonData, currentBisSet,
  currentSnapshot, acquisitionData, mergedItemDataMap,
} from "../state.ts";
import { Corners } from "../components/Corners.tsx";

// ---- Materia circles -------------------------------------------------------

function MateriaCircles({ piece, itemDataMap }: { piece: EquipmentPiece; itemDataMap: Map<number, ItemData> }) {
  const totalSlots = piece.canOvermeld ? 5 : Math.min(piece.materiaSlots ?? 2, 2);
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

function MateriaCompareCircles({ piece, bisItem, itemDataMap }: {
  piece: EquipmentPiece | null;
  bisItem: EquipmentPiece | null;
  itemDataMap: Map<number, ItemData>;
}) {
  const equippedSlots = piece?.canOvermeld ? 5 : Math.min(piece?.materiaSlots ?? 2, 2);
  const totalSlots = Math.max(equippedSlots, bisItem?.materias?.length ?? 0, 2);
  return (
    <div class="flex gap-1 items-center mt-1">
      {Array.from({ length: totalSlots }, (_, i) => {
        const equippedId = piece?.materias[i] ?? 0;
        const bisId      = bisItem?.materias[i] ?? 0;
        const filled     = equippedId !== 0;
        const isOvermeld = i >= 2;
        const matches    = equippedId === bisId;
        const title      = filled ? (itemDataMap.get(equippedId)?.name ?? `Materia #${equippedId}`) : undefined;
        if (!filled) {
          const border = isOvermeld ? "border-red-800" : "border-blue-800";
          return <span key={i} data-tooltip={title} class={`w-2.5 h-2.5 rounded-full border ${border} flex-shrink-0 inline-block`} />;
        }
        const bg = matches ? "bg-blue-400" : (isOvermeld ? "bg-red-500" : "bg-yellow-500");
        return <span key={i} data-tooltip={title} class={`w-2.5 h-2.5 rounded-full ${bg} flex-shrink-0 inline-block`} />;
      })}
    </div>
  );
}

// ---- Modal item column -----------------------------------------------------

function ModalItemColumn({ heading, piece, bisItem, itemDataMap, status }: {
  heading: string;
  piece: EquipmentPiece | null;
  bisItem: EquipmentPiece | null;
  itemDataMap: Map<number, ItemData>;
  status: string;
}) {
  const isBis      = heading === "BIS";
  const data       = piece ? itemDataMap.get(piece.itemId) : null;
  const name       = data?.name ?? (piece ? `Item #${piece.itemId}` : "—");
  const itemLevel  = data?.itemLevel ?? "?";
  const nameColor  = status === "wrong-item"
    ? (isBis ? "text-green-400" : "text-red-400")
    : "text-gray-100";

  return (
    <div class="flex-1 min-w-0">
      <p class="text-[10px] text-gray-500 uppercase tracking-wide mb-2">{heading}</p>
      <div class="relative flex items-start gap-2 bg-ffxiv-dark border border-ffxiv-border rounded p-2">
        <Corners />
        {data?.icon
          ? <img src={data.icon} alt="" class="w-10 h-10 rounded object-cover flex-shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          : <div class="w-10 h-10 rounded bg-ffxiv-border flex-shrink-0" />
        }
        <div class="flex-1 min-w-0">
          <p class={`text-xs font-medium ${nameColor} truncate`}>{name}</p>
          {piece
            ? <p class="text-[10px] text-ffxiv-gold font-mono mt-0.5">iLvl {itemLevel}</p>
            : <p class="text-xs text-gray-500 italic">Empty</p>
          }
          {piece && (status === "wrong-materia"
            ? <MateriaCompareCircles piece={piece} bisItem={bisItem} itemDataMap={itemDataMap} />
            : <MateriaCircles piece={piece} itemDataMap={itemDataMap} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Advice sections -------------------------------------------------------

function AdviceBlock({ label, ready, children }: {
  label: string;
  ready: boolean;
  children: preact.ComponentChildren;
}) {
  return (
    <div>
      <p class={`text-[10px] ${ready ? "text-green-400" : "text-gray-500"} uppercase tracking-wide font-semibold mb-1`}>
        {label}
      </p>
      <p class="text-xs text-gray-300 leading-relaxed">{children}</p>
    </div>
  );
}

function materiaSetDiff(equipped: number[], bis: number[]): { toAdd: number[]; toRemove: number[] } {
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

function MateriaAdvice({ slotComp, itemDataMap }: { slotComp: SlotComparison; itemDataMap: Map<number, ItemData> }) {
  const equipped  = slotComp.equippedMaterias ?? [];
  const bis       = slotComp.bisMaterias ?? [];
  const { toAdd, toRemove } = materiaSetDiff(equipped, bis);
  const bisCount  = bis.filter(id => id !== 0).length;

  return (
    <>
      {toRemove.length > 0 && (
        <div>
          <p class="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Remove</p>
          {toRemove.map((id, i) => (
            <p key={i} class="text-xs text-red-400">&minus; {itemDataMap.get(id)?.name ?? `Materia #${id}`}</p>
          ))}
        </div>
      )}
      {toAdd.length > 0 && (
        <div class={toRemove.length > 0 ? "mt-2" : ""}>
          <p class="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Add</p>
          {toAdd.map((id, i) => (
            <p key={i} class="text-xs text-green-400">+ {itemDataMap.get(id)?.name ?? `Materia #${id}`}</p>
          ))}
        </div>
      )}
      {bisCount > 2 && (
        <p class="text-[10px] text-yellow-600 mt-2">
          {bisCount - 2} overmeld slot{bisCount - 2 !== 1 ? "s" : ""} required &mdash; success is not guaranteed.
        </p>
      )}
    </>
  );
}

function AcquisitionAdvice({ s, itemDataMap }: {
  s: Pick<SlotAcquisitionStatus, "coffer" | "books" | "upgrade">;
  itemDataMap: Map<number, ItemData>;
}) {
  const iname = (id: number, fallback: string): string => itemDataMap.get(id)?.name ?? fallback;
  const sections: preact.ComponentChildren[] = [];

  if (s.coffer) {
    const { coffer, available } = s.coffer;
    const cofferName = iname(coffer.itemId, coffer.name);
    sections.push(
      <AdviceBlock key="coffer" label="Coffer" ready={available}>
        {available
          ? <>You have the <strong>{cofferName}</strong> in your bags &mdash; open it to get this piece.</>
          : <>Need the <strong>{cofferName}</strong>. Drops from savage raid.</>
        }
      </AdviceBlock>,
    );
  }

  if (s.books) {
    const { book, available } = s.books;
    const bookName = iname(book.itemId, book.name);
    sections.push(
      <AdviceBlock key="books" label="Books" ready={available}>
        {available
          ? <>Trade {book.need}&times; <strong>{bookName}</strong> at the vendor (you have {book.have}).</>
          : <>Need {book.need}&times; <strong>{bookName}</strong> to buy the raid piece (have {book.have}).</>
        }
      </AdviceBlock>,
    );
  }

  if (s.upgrade) {
    const { base, material, available } = s.upgrade as UpgradePathStatus;
    const tomeName  = iname(base.tomes.itemId,          base.tomes.name);
    const matName   = iname(material.material.itemId,   material.material.name);
    const bookName  = iname(material.bookCost.book.itemId, material.bookCost.book.name);

    const baseDetail = base.haveBaseEquipped
      ? <>780 base piece is equipped &mdash; unequip before trading at the vendor. </>
      : base.haveBase
        ? <>You have the 780 base piece. </>
        : base.canBuyWithTomes
          ? <>Buy the 780 base with <strong>{base.tomes.need} {tomeName}</strong> (have {base.tomes.have}). </>
          : <>Need <strong>{base.tomes.need} {tomeName}</strong> for the 780 base (have {base.tomes.have}). </>;

    const matDetail = material.available
      ? <><strong>{matName}</strong> is in your bags &mdash; ready to upgrade at the vendor.</>
      : material.bookCost.available
        ? <>Trade {material.bookCost.book.need}&times; <strong>{bookName}</strong> for <strong>{matName}</strong> (have {material.bookCost.book.have}).</>
        : <>Need <strong>{matName}</strong> &mdash; costs {material.bookCost.book.need}&times; <strong>{bookName}</strong> (have {material.bookCost.book.have}).</>;

    sections.push(
      <AdviceBlock key="upgrade" label="Upgrade" ready={available}>
        {baseDetail}<br />{matDetail}
      </AdviceBlock>,
    );
  }

  if (sections.length === 0) {
    return <p class="text-xs text-gray-500 italic">No acquisition data for this slot yet.</p>;
  }
  return <>{sections}</>;
}

// ---- Main component --------------------------------------------------------

export function CompareModal() {
  const slot = selectedSlot.value;
  if (!slot) return null;

  const compData = comparisonData.value;
  const bisSet   = currentBisSet.value;
  if (!compData || !bisSet) return null;

  const slotComp = compData.slots.find(s => s.slot === slot);
  if (!slotComp || slotComp.status === "match" || slotComp.status === "bis-empty") return null;

  const slotKey  = slot as SlotName;
  const equipped = currentSnapshot.value?.items[slotKey] ?? null;
  const bisRaw   = bisSet.items[slotKey] ?? null;
  const merged   = mergedItemDataMap();

  const bisPiece: EquipmentPiece | null = bisRaw
    ? { itemId: bisRaw.itemId, materias: bisRaw.materias, hq: false, canOvermeld: false, materiaSlots: 0 }
    : null;

  const slotAcq = acquisitionData.value?.find(s => s.slot === slot) ?? null;
  const close = (): void => { selectedSlot.value = null; };

  return (
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div class="modal-card bg-ffxiv-panel border border-ffxiv-border rounded-xl w-[520px] max-w-[90vw] max-h-[85vh] overflow-y-auto p-5 relative shadow-xl">
        <button
          class="absolute top-3 right-3 text-gray-500 hover:text-gray-200 text-lg leading-none"
          onClick={close}
        >
          &#x2715;
        </button>
        <h2 class="font-cinzel text-sm font-semibold text-ffxiv-gold uppercase tracking-wide mb-4">
          {SLOT_LABELS[slot] ?? slot}
        </h2>
        <div class="flex gap-4">
          <ModalItemColumn heading="Equipped" piece={equipped}  bisItem={bisPiece} itemDataMap={merged} status={slotComp.status} />
          <div class="w-px bg-ffxiv-border flex-shrink-0" />
          <ModalItemColumn heading="BIS"      piece={bisPiece}  bisItem={equipped} itemDataMap={merged} status={slotComp.status} />
        </div>
        <div class="mt-4 pt-4 border-t border-ffxiv-border space-y-3">
          {slotComp.status === "wrong-materia"
            ? <MateriaAdvice slotComp={slotComp} itemDataMap={merged} />
            : <AcquisitionAdvice s={slotAcq ?? { coffer: null, books: null, upgrade: null }} itemDataMap={merged} />
          }
        </div>
      </div>
    </div>
  );
}

// ---- Backward-compat wrappers (called by GearTab, AcquisitionTab) ----------

export function openCompareModal(slot: string): void {
  selectedSlot.value = slot as SlotName;
}

export function closeModal(): void {
  selectedSlot.value = null;
}
