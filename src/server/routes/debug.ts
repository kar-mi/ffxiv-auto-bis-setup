import { readFile } from "node:fs/promises";
import type { ServerCtx } from '../ctx.ts';
import { json } from '../helpers.ts';
import { peekItemData } from '../../xivapi/item-data.ts';
import { parseItemOdr, buildPosMap } from '../../dat/itemodr.ts';
import { getFfxivDataDir, findItemodrPath } from '../../dat/finder.ts';
import { INVENTORY_LOG_ENABLED } from '../../debug/inventory-log.ts';

const CONTAINER_GROUP: Record<number, string> = {
  0: "Bags", 1: "Bags", 2: "Bags", 3: "Bags",
  2000: "Currency", 2001: "Crystals",
  3500: "Armory: Main-hand", 3200: "Armory: Off-hand",
  3201: "Armory: Head",  3202: "Armory: Body",  3203: "Armory: Hands",
  3205: "Armory: Legs",  3206: "Armory: Feet",
  3207: "Armory: Neck",  3208: "Armory: Ears",  3209: "Armory: Wrists",
  3300: "Armory: Rings", 3400: "Armory: Soul Crystal",
};

const GROUP_ORDER = [
  "Bags", "Currency", "Crystals",
  "Armory: Main-hand", "Armory: Off-hand",
  "Armory: Head", "Armory: Body", "Armory: Hands",
  "Armory: Legs", "Armory: Feet",
  "Armory: Neck", "Armory: Ears", "Armory: Wrists",
  "Armory: Rings", "Armory: Soul Crystal",
];

export async function tryHandle(req: Request, ctx: ServerCtx): Promise<Response | null> {
  const { pathname } = new URL(req.url);

  if (pathname === "/debug/inventory" && req.method === "GET") {
    const inv = ctx.getLatestInventory();
    if (!inv) return json({ odrLoaded: false, byContainer: {} });

    let posMap = new Map<string, number>();
    let odrLoaded = false;
    try {
      const datPath = await findItemodrPath(getFfxivDataDir());
      if (datPath) {
        const buf = await readFile(datPath);
        posMap = buildPosMap(parseItemOdr(buf as unknown as Buffer));
        odrLoaded = true;
      }
    } catch (err) {
      console.warn("[debug] ITEMODR.DAT load failed:", err);
    }

    type DisplayEntry = { group: string; itemId: number; quantity: number; hq: boolean; location: number | null };
    const entries: DisplayEntry[] = inv.items.map(item => {
      const group = CONTAINER_GROUP[item.containerId] ?? `Container ${item.containerId}`;
      const rawPos = posMap.get(`${item.containerId}:${item.slot}`);
      return { group, itemId: item.itemId, quantity: item.quantity, hq: item.hq, location: rawPos !== undefined ? rawPos + 1 : null };
    });

    entries.sort((a, b) => {
      const gi = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
      if (gi !== 0) return gi;
      if (a.location === null && b.location === null) return 0;
      if (a.location === null) return 1;
      if (b.location === null) return -1;
      return a.location - b.location;
    });

    const byContainer: Record<string, unknown[]> = {};
    for (const entry of entries) {
      if (!byContainer[entry.group]) byContainer[entry.group] = [];
      const name = peekItemData(entry.itemId)?.name;
      byContainer[entry.group].push({ itemId: entry.itemId, quantity: entry.quantity, hq: entry.hq, location: entry.location, name });
    }

    return json({
      odrLoaded,
      logFile: INVENTORY_LOG_ENABLED ? "logs/inventory.jsonl" : null,
      capturedAt: inv.capturedAt,
      byContainer,
    });
  }

  return null;
}
