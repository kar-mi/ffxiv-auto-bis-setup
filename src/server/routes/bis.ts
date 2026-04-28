import type { RaidTier } from '../../types.ts';
import type { ServerCtx } from '../ctx.ts';
import { json } from '../helpers.ts';
import { getBisSet, fetchSetNames, resolveSetIndex } from '../../bis/xivgear.ts';
import { compareGear } from '../../bis/comparison.ts';
import { fetchBisLinks } from '../../bis/balance.ts';
import { computeNeeds } from '../../bis/needs.ts';
import {
  loadCatalog, saveCatalog, upsertSet, removeSet,
  setPreference, clearPreference, makeEntryId, canonicalUrl,
} from '../../bis/local-store.ts';
import { loadGearAcquisitionMap } from '../../acquisition/loader.ts';
import { computeAcquisition } from '../../acquisition/compute.ts';
import { fetchItemData } from '../../xivapi/item-data.ts';

async function buildUpgradeBisIds(
  gearNeeds: ReturnType<typeof computeNeeds>,
  bisSet: Awaited<ReturnType<typeof getBisSet>>,
  acquisitionMap: Awaited<ReturnType<typeof loadGearAcquisitionMap>>,
): Promise<Set<number>> {
  const upgradeBisIds = new Set<number>();
  await Promise.all(gearNeeds.itemNeeds.map(async need => {
    const bisItem = bisSet.items[need.slot];
    if (bisItem?.itemLevel !== undefined) {
      if (acquisitionMap.upgradeILevel && bisItem.itemLevel === acquisitionMap.upgradeILevel) {
        upgradeBisIds.add(need.bisItemId);
      }
    } else {
      const baseId = need.bisItemId - acquisitionMap.upgradeOffset;
      if (baseId > 0) {
        const data = await fetchItemData(baseId);
        if (data.itemLevel === acquisitionMap.baseILevel) upgradeBisIds.add(need.bisItemId);
      }
    }
  }));
  return upgradeBisIds;
}

export async function tryHandle(req: Request, ctx: ServerCtx): Promise<Response | null> {
  const { pathname } = new URL(req.url);

  if (pathname === "/bis/catalog" && req.method === "GET") {
    return json(await loadCatalog(ctx.projectRoot));
  }

  if (pathname === "/bis/catalog/sets" && req.method === "POST") {
    const body = (await req.json()) as { url?: string; setIndex?: number; raidTier?: string };
    if (!body.url || !body.raidTier) return json({ error: "Missing url or raidTier" }, 400);
    const VALID_TIERS = new Set<string>(["aac_lw", "aac_mw", "aac_hw", "ultimate", "criterion", "other"]);
    if (!VALID_TIERS.has(body.raidTier)) return json({ error: `Invalid raidTier "${body.raidTier}"` }, 400);
    try {
      const resolvedIndex = body.setIndex ?? await resolveSetIndex(body.url);
      const bisSet = await getBisSet(body.url, resolvedIndex);
      const id = makeEntryId(body.url, resolvedIndex);
      const url = canonicalUrl(body.url, resolvedIndex);
      const entry = { id, url, setIndex: resolvedIndex, savedAt: new Date().toISOString(), set: bisSet, raidTier: body.raidTier as RaidTier };
      let catalog = await loadCatalog(ctx.projectRoot);
      catalog = upsertSet(catalog, entry);
      await saveCatalog(ctx.projectRoot, catalog);
      return json(entry);
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }

  const catalogSetMatch = pathname.match(/^\/bis\/catalog\/sets\/([^/]+)$/);
  if (catalogSetMatch && req.method === "PATCH") {
    const id = decodeURIComponent(catalogSetMatch[1]);
    const body = (await req.json()) as { raidTier?: string; name?: string };
    if (!body.raidTier && !body.name) return json({ error: "Nothing to update" }, 400);
    let catalog = await loadCatalog(ctx.projectRoot);
    const existing = catalog.sets.find(s => s.id === id);
    if (!existing) return json({ error: `No catalog entry with id "${id}"` }, 404);
    const updated = {
      ...existing,
      ...(body.raidTier ? { raidTier: body.raidTier as RaidTier } : {}),
      ...(body.name     ? { set: { ...existing.set, name: body.name } } : {}),
    };
    catalog = upsertSet(catalog, updated);
    await saveCatalog(ctx.projectRoot, catalog);
    return json(updated);
  }
  if (catalogSetMatch && req.method === "DELETE") {
    const id = decodeURIComponent(catalogSetMatch[1]);
    let catalog = await loadCatalog(ctx.projectRoot);
    catalog = removeSet(catalog, id);
    await saveCatalog(ctx.projectRoot, catalog);
    return json({ ok: true });
  }

  const prefMatch = pathname.match(/^\/bis\/catalog\/preferences\/([^/]+)$/);
  if (prefMatch) {
    const job = decodeURIComponent(prefMatch[1]).toUpperCase();
    if (req.method === "PUT") {
      const body = (await req.json()) as { id?: string };
      if (!body.id) return json({ error: "Missing id" }, 400);
      let catalog = await loadCatalog(ctx.projectRoot);
      if (!catalog.sets.find(s => s.id === body.id)) {
        return json({ error: `No catalog entry with id "${body.id}"` }, 404);
      }
      catalog = setPreference(catalog, job, body.id);
      await saveCatalog(ctx.projectRoot, catalog);
      return json({ ok: true });
    }
    if (req.method === "DELETE") {
      let catalog = await loadCatalog(ctx.projectRoot);
      catalog = clearPreference(catalog, job);
      await saveCatalog(ctx.projectRoot, catalog);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  }

  const balanceMatch = pathname.match(/^\/balance\/([^/]+)\/([^/]+)$/);
  if (balanceMatch && req.method === "GET") {
    try {
      return json(await fetchBisLinks(balanceMatch[1], balanceMatch[2]));
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }

  if (pathname === "/bis/sets" && req.method === "GET") {
    const xivgearUrl = new URL(req.url).searchParams.get("url");
    if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
    try {
      return json(await fetchSetNames(xivgearUrl));
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }

  if (pathname === "/bis" && req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const xivgearUrl = params.get("url");
    if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
    try {
      const setIndex = await resolveSetIndex(xivgearUrl, params.get("set") ?? undefined);
      return json(await getBisSet(xivgearUrl, setIndex));
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }

  if (pathname === "/compare" && req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const xivgearUrl = params.get("url");
    if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
    const gear = ctx.getSelectedGear();
    if (!gear) return json({ error: "No packet-captured gear available yet" }, 409);
    try {
      const setIndex = await resolveSetIndex(xivgearUrl, params.get("set") ?? undefined);
      return json(compareGear(gear, await getBisSet(xivgearUrl, setIndex)));
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }

  if (pathname === "/needs" && req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const xivgearUrl = params.get("url");
    if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
    const gear = ctx.getSelectedGear();
    if (!gear) return json({ error: "No packet-captured gear available yet" }, 409);
    try {
      const setIndex = await resolveSetIndex(xivgearUrl, params.get("set") ?? undefined);
      const bisSet = await getBisSet(xivgearUrl, setIndex);
      return json(computeNeeds(compareGear(gear, bisSet), bisSet, ctx.getLatestInventory()));
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }

  // GET /bis/full — single bundled response: bisSet + comparison + needs + acquisition
  if (pathname === "/bis/full" && req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const xivgearUrl = params.get("url");
    if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
    const gear = ctx.getSelectedGear();
    if (!gear) return json({ error: "No packet-captured gear available yet" }, 409);
    try {
      const setIndex = await resolveSetIndex(xivgearUrl, params.get("set") ?? undefined);
      const bisSet = await getBisSet(xivgearUrl, setIndex);
      const comparison = compareGear(gear, bisSet);
      const inventory = ctx.getLatestInventory();
      const needs = computeNeeds(comparison, bisSet, inventory);
      const acquisitionMap = await loadGearAcquisitionMap(ctx.projectRoot);
      const upgradeBisIds = await buildUpgradeBisIds(needs, bisSet, acquisitionMap);
      const acquisition = computeAcquisition(needs, acquisitionMap, inventory, upgradeBisIds, gear);
      return json({ bisSet, comparison, needs, acquisition });
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  }

  return null;
}
