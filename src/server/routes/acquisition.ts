import type { ServerCtx } from '../ctx.ts';
import { json } from '../helpers.ts';
import { getBisSet, resolveSetIndex } from '../../bis/xivgear.ts';
import { compareGear } from '../../bis/comparison.ts';
import { computeNeeds } from '../../bis/needs.ts';
import { loadGearAcquisitionMap } from '../../acquisition/loader.ts';
import { computeAcquisition, buildCounts } from '../../acquisition/compute.ts';
import { fetchItemData } from '../../xivapi/item-data.ts';
import { buildUpgradeBisIds } from '../../acquisition/upgrade-detection.ts';

export async function tryHandle(req: Request, ctx: ServerCtx): Promise<Response | null> {
  const { pathname } = new URL(req.url);

  if (pathname === "/acquisition" && req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const xivgearUrl = params.get("url");
    if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
    const gear = ctx.getSelectedGear();
    if (!gear) return json({ error: "No packet-captured gear available yet" }, 409);
    try {
      const setIndex = await resolveSetIndex(xivgearUrl, params.get("set") ?? undefined);
      const bisSet = await getBisSet(xivgearUrl, setIndex);
      const comparison = compareGear(gear, bisSet);
      const gearNeeds = computeNeeds(comparison, bisSet, ctx.getLatestInventory());
      const acquisitionMap = await loadGearAcquisitionMap(ctx.projectRoot);
      const upgradeBisIds = await buildUpgradeBisIds(gearNeeds, bisSet, acquisitionMap);
      return json(computeAcquisition(gearNeeds, acquisitionMap, ctx.getLatestInventory(), upgradeBisIds, gear));
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }

  if (pathname === "/upgrade-items" && req.method === "GET") {
    const params     = new URL(req.url).searchParams;
    const xivgearUrl = params.get("url") ?? null;
    const setParam   = params.get("set") ?? undefined;

    const acquisitionMap = await loadGearAcquisitionMap(ctx.projectRoot);
    const counts = buildCounts(ctx.getLatestInventory());
    const have = (id: number) => id === 0 ? 0 : (counts.get(id) ?? 0);

    const allIds = new Set<number>();
    if (acquisitionMap.tomeId !== 0) allIds.add(acquisitionMap.tomeId);
    for (const slot of Object.values(acquisitionMap.slots)) {
      if (slot?.cofferItemId != null && slot.cofferItemId !== 0) allIds.add(slot.cofferItemId);
    }
    for (const m of acquisitionMap.upgradeMaterials) { if (m.itemId !== 0) allIds.add(m.itemId); }
    for (const b of acquisitionMap.books) { if (b.itemId !== 0) allIds.add(b.itemId); }

    const itemDataMap = new Map(
      await Promise.all([...allIds].map(async id => [id, await fetchItemData(id)] as const))
    );
    const resolve = (id: number, fallbackName: string) => {
      const d = itemDataMap.get(id);
      return { name: d?.name ?? fallbackName, icon: d?.icon ?? null };
    };

    const currency = acquisitionMap.tomeId !== 0 ? [(() => {
      const { name, icon } = resolve(acquisitionMap.tomeId, acquisitionMap.tomeName);
      return { itemId: acquisitionMap.tomeId, name, icon, have: have(acquisitionMap.tomeId) };
    })()] : [];

    const cofferSeen = new Set<number>();
    const coffers: { itemId: number; name: string; icon: string | null; have: number }[] = [];
    for (const slot of Object.values(acquisitionMap.slots)) {
      if (!slot || slot.cofferItemId == null || slot.cofferItemId === 0 || cofferSeen.has(slot.cofferItemId)) continue;
      cofferSeen.add(slot.cofferItemId);
      const { name, icon } = resolve(slot.cofferItemId, "");
      coffers.push({ itemId: slot.cofferItemId, name, icon, have: have(slot.cofferItemId) });
    }

    const materials = acquisitionMap.upgradeMaterials.map(m => {
      const { name, icon } = resolve(m.itemId, m.name);
      return { itemId: m.itemId, name, icon, have: have(m.itemId) };
    });

    const bookSeen = new Set<number>();
    const books: { itemId: number; name: string; icon: string | null; have: number }[] = [];
    for (const book of acquisitionMap.books) {
      if (book.itemId === 0 || bookSeen.has(book.itemId)) continue;
      bookSeen.add(book.itemId);
      const { name, icon } = resolve(book.itemId, book.name);
      books.push({ itemId: book.itemId, name, icon, have: have(book.itemId) });
    }

    type BaseGearEntry = {
      slot: string; itemId: number; name: string; icon: string | null;
      haveEquipped: boolean; haveInBags: number; haveInArmory: number;
    };
    type MateriaEntry = { itemId: number; name: string; icon: string | null; have: number };
    let baseGear: BaseGearEntry[] | undefined;
    let materia: MateriaEntry[] | undefined;

    if (xivgearUrl && ctx.getSelectedGear()) {
      try {
        const gear = ctx.getSelectedGear()!;
        const inv  = ctx.getLatestInventory();
        const setIndex  = await resolveSetIndex(xivgearUrl, setParam);
        const bisSet    = await getBisSet(xivgearUrl, setIndex);
        const comparison = compareGear(gear, bisSet);
        const gearNeeds  = computeNeeds(comparison, bisSet, inv);
        const upgradeBisIds = await buildUpgradeBisIds(gearNeeds, bisSet, acquisitionMap);

        baseGear = await Promise.all(
          gearNeeds.itemNeeds
            .filter(need => upgradeBisIds.has(need.bisItemId))
            .map(async need => {
              const baseId = need.bisItemId - acquisitionMap.upgradeOffset;
              const d = await fetchItemData(baseId);
              const invItems = inv?.items ?? [];
              return {
                slot: need.slot,
                itemId: baseId,
                name: d.name,
                icon: d.icon,
                haveEquipped: Object.values(gear.items).some(e => e?.itemId === baseId),
                haveInBags:   invItems.filter(i => i.itemId === baseId && i.containerId <= 3).reduce((s, i) => s + i.quantity, 0),
                haveInArmory: invItems.filter(i => i.itemId === baseId && i.containerId >= 3200).reduce((s, i) => s + i.quantity, 0),
              };
            })
        );

        const materiaCount = new Map<number, number>();
        for (const change of gearNeeds.materiaChanges) {
          for (const mId of change.toAdd) {
            materiaCount.set(mId, (materiaCount.get(mId) ?? 0) + 1);
          }
        }
        if (materiaCount.size > 0) {
          materia = await Promise.all(
            [...materiaCount.keys()].map(async id => {
              const d = await fetchItemData(id);
              return { itemId: id, name: d.name, icon: d.icon, have: have(id) };
            })
          );
        }
      } catch {
        // silently omit baseGear/materia if BIS fetch fails
      }
    }

    return json({ currency, coffers, materials, ...(materia ? { materia } : {}), books, ...(baseGear ? { baseGear } : {}) });
  }

  return null;
}
