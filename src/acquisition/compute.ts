import type { GearNeeds, GearSnapshot, InventorySnapshot, SlotName } from '../types.ts';
import { buildItemCounts } from '../inventory/counts.ts';
export { buildItemCounts as buildCounts } from '../inventory/counts.ts';
import type {
  GearAcquisitionMap,
  SlotAcquisitionStatus,
  CofferStatus,
  BookExchangeStatus,
  UpgradeMaterialStatus,
  UpgradeMaterialDef,
  AllianceTradeInStatus,
  BaseItemStatus,
  UpgradePathStatus,
  ItemCount,
} from './types.ts';

function qty(counts: Map<number, number>, itemId: number): number {
  if (itemId === 0) return 0; // placeholder — not yet mapped
  return counts.get(itemId) ?? 0;
}

function itemCount(counts: Map<number, number>, itemId: number, name: string, need: number): ItemCount {
  return { itemId, name, have: qty(counts, itemId), need };
}

function canUseAllianceTradeIn(material: UpgradeMaterialDef): boolean {
  return material.key === 'twine' || material.key === 'glaze';
}

function allianceTradeInStatus(
  counts: Map<number, number>,
  map: GearAcquisitionMap,
  material: UpgradeMaterialDef,
): AllianceTradeInStatus | null {
  if (!canUseAllianceTradeIn(material) || !map.alliance_trade_in?.length) return null;
  const items = map.alliance_trade_in.map(item => itemCount(counts, item.itemId, item.name, 1));
  return { items, available: items.every(item => item.have >= item.need) };
}

/**
 * For each slot in `needs.itemNeeds`, compute all acquisition paths and
 * cross-reference them against the current inventory and equipped gear.
 *
 * `upgradeBisIds` — set of bisItemIds confirmed (via XIVAPI iLevel check) to be
 * upgraded tome pieces. Those slots show only the upgrade path; all others show
 * only the coffer/books raid path.
 *
 * `gear` — the current gear snapshot; used to detect 780 base pieces that are
 * equipped but not yet in bags/armory (container 1000 is absent from inventory).
 */
export function computeAcquisition(
  needs: GearNeeds,
  map: GearAcquisitionMap,
  inventory: InventorySnapshot | null,
  upgradeBisIds: Set<number> = new Set(),
  gear: GearSnapshot | null = null,
): SlotAcquisitionStatus[] {
  const counts = buildItemCounts(inventory);

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

    const isUpgradePath = upgradeBisIds.has(need.bisItemId);

    // bookIndex >= books.length is a sentinel meaning "no book exchange" (e.g. weapon).
    const book = slotAcq.bookIndex != null && slotAcq.bookIndex < map.books.length ? (map.books[slotAcq.bookIndex] ?? null) : null;
    const upgMat = slotAcq.upgradeMaterialKey ? (map.upgradeMaterials.find(m => m.key === slotAcq.upgradeMaterialKey) ?? null) : null;
    const upgMatBook = upgMat ? (map.books[upgMat.bookIndex] ?? null) : null;

    // ---- Coffer (raid path only) ----
    const coffer: CofferStatus | null = (!isUpgradePath && slotAcq.cofferItemId != null && slotAcq.cofferItemId !== 0) ? (() => {
      const ic = itemCount(counts, slotAcq.cofferItemId, `Coffer`, 1);
      return { coffer: ic, available: ic.have >= 1 };
    })() : null;

    // ---- Books → raid piece (raid path only) ----
    const books: BookExchangeStatus | null = (!isUpgradePath && book && book.itemId !== 0 && slotAcq.bookCount != null) ? (() => {
      const ic = itemCount(counts, book.itemId, book.name, slotAcq.bookCount);
      return { book: ic, available: ic.have >= slotAcq.bookCount };
    })() : null;

    // ---- Upgrade path (780 base + material → 790) ----
    // bisItemId IS the upgradeItemId for upgrade-path slots.
    const hasUpgradeData = isUpgradePath;
    const upgrade: UpgradePathStatus | null = hasUpgradeData ? (() => {
      const baseItemId = need.bisItemId - map.upgradeOffset;
      const haveBaseInInventory = qty(counts, baseItemId) >= 1;
      const haveBaseEquipped    = gear?.items[need.slot as SlotName]?.itemId === baseItemId;
      const base: BaseItemStatus = {
        baseItem: itemCount(counts, baseItemId, `780 base (${need.slot})`, 1),
        haveBase: haveBaseInInventory || haveBaseEquipped,
        haveBaseEquipped,
        tomes: itemCount(counts, map.tomeId, map.tomeName, slotAcq.tomeCost ?? 0),
        canBuyWithTomes: qty(counts, map.tomeId) >= (slotAcq.tomeCost ?? 0),
      };

      const material: UpgradeMaterialStatus = upgMat && upgMatBook ? (() => {
        const bookCost: BookExchangeStatus = {
          book: itemCount(counts, upgMatBook.itemId, upgMatBook.name, upgMat.bookCount),
          available: qty(counts, upgMatBook.itemId) >= upgMat.bookCount,
        };
        const mat = itemCount(counts, upgMat.itemId, upgMat.name, 1);
        return {
          material: mat,
          available: mat.have >= 1,
          bookCost,
          allianceTradeIn: allianceTradeInStatus(counts, map, upgMat),
        };
      })() : {
        material: { itemId: 0, name: 'Unknown upgrade material', have: 0, need: 1 },
        available: false,
        bookCost: { book: { itemId: 0, name: 'Unknown', have: 0, need: 0 }, available: false },
        allianceTradeIn: null,
      };

      const available =
        (base.haveBase || base.canBuyWithTomes) &&
        (material.available || material.bookCost.available || (material.allianceTradeIn?.available ?? false));

      return { upgradeItemId: need.bisItemId, base, material, available };
    })() : null;

    const canAcquireNow =
      (coffer?.available ?? false) ||
      (books?.available ?? false) ||
      (upgrade?.available ?? false);

    return { slot: need.slot, bisItemId: need.bisItemId, coffer, books, upgrade, canAcquireNow };
  });
}
