import type { GearNeeds, InventorySnapshot } from '../types.ts';
import type {
  GearAcquisitionMap,
  SlotAcquisitionStatus,
  CofferStatus,
  BookExchangeStatus,
  UpgradeMaterialStatus,
  BaseItemStatus,
  UpgradePathStatus,
  ItemCount,
} from './types.ts';

/** Build itemId → total quantity from all tracked inventory (bags + armory). */
function buildCounts(inventory: InventorySnapshot | null): Map<number, number> {
  const counts = new Map<number, number>();
  if (!inventory) return counts;
  for (const item of inventory.items) {
    if (item.itemId === 0 || item.quantity === 0) continue;
    counts.set(item.itemId, (counts.get(item.itemId) ?? 0) + item.quantity);
  }
  return counts;
}

function qty(counts: Map<number, number>, itemId: number): number {
  if (itemId === 0) return 0; // placeholder — not yet mapped
  return counts.get(itemId) ?? 0;
}

function itemCount(counts: Map<number, number>, itemId: number, name: string, need: number): ItemCount {
  return { itemId, name, have: qty(counts, itemId), need };
}

/**
 * For each slot in `needs.itemNeeds`, compute all acquisition paths and
 * cross-reference them against the current inventory.
 */
export function computeAcquisition(
  needs: GearNeeds,
  map: GearAcquisitionMap,
  inventory: InventorySnapshot | null,
): SlotAcquisitionStatus[] {
  const counts = buildCounts(inventory);

  return needs.itemNeeds.map(need => {
    const slotAcq = map.slots[need.slot];
    if (!slotAcq) {
      return {
        slot: need.slot,
        bisItemId: need.bisItemId,
        coffer: null,
        books: null,
        upgrade: null,
        canAcquireNow: false,
      };
    }

    // bookIndex >= books.length is a sentinel meaning "no book exchange" (e.g. weapon).
    const book = slotAcq.bookIndex < map.books.length ? (map.books[slotAcq.bookIndex] ?? null) : null;
    const upgMat = map.upgradeMaterials.find(m => m.key === slotAcq.upgradeMaterialKey) ?? null;
    const upgMatBook = upgMat ? (map.books[upgMat.bookIndex] ?? null) : null;

    // ---- Coffer ----
    const coffer: CofferStatus | null = slotAcq.cofferItemId !== 0 ? (() => {
      const ic = itemCount(counts, slotAcq.cofferItemId, `Coffer`, 1);
      return { coffer: ic, available: ic.have >= 1 };
    })() : null;

    // ---- Books → raid piece ----
    const books: BookExchangeStatus | null = (book && book.itemId !== 0) ? (() => {
      const ic = itemCount(counts, book.itemId, book.name, slotAcq.bookCount);
      return { book: ic, available: ic.have >= slotAcq.bookCount };
    })() : null;

    // ---- Upgrade path (780 base + material → 790) ----
    const hasUpgradeData = slotAcq.currencyItemId !== 0 || slotAcq.upgradeItemId !== 0;
    const upgrade: UpgradePathStatus | null = hasUpgradeData ? (() => {
      const base: BaseItemStatus = {
        baseItem: itemCount(counts, slotAcq.currencyItemId, `780 base (${need.slot})`, 1),
        haveBase: qty(counts, slotAcq.currencyItemId) >= 1,
        tomes: itemCount(counts, map.tomeId, map.tomeName, slotAcq.tomeCost),
        canBuyWithTomes: qty(counts, map.tomeId) >= slotAcq.tomeCost,
      };

      const material: UpgradeMaterialStatus = upgMat && upgMatBook ? (() => {
        const bookCost: BookExchangeStatus = {
          book: itemCount(counts, upgMatBook.itemId, upgMatBook.name, upgMat.bookCount),
          available: qty(counts, upgMatBook.itemId) >= upgMat.bookCount,
        };
        const mat = itemCount(counts, upgMat.itemId, upgMat.name, 1);
        return { material: mat, available: mat.have >= 1, bookCost };
      })() : {
        material: { itemId: 0, name: 'Unknown upgrade material', have: 0, need: 1 },
        available: false,
        bookCost: { book: { itemId: 0, name: 'Unknown', have: 0, need: 0 }, available: false },
      };

      const available =
        (base.haveBase || base.canBuyWithTomes) &&
        (material.available || material.bookCost.available);

      return { upgradeItemId: slotAcq.upgradeItemId, base, material, available };
    })() : null;

    const canAcquireNow =
      (coffer?.available ?? false) ||
      (books?.available ?? false) ||
      (upgrade?.available ?? false);

    return { slot: need.slot, bisItemId: need.bisItemId, coffer, books, upgrade, canAcquireNow };
  });
}
