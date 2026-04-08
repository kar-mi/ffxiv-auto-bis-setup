import path from "path";
import { readFile } from "node:fs/promises";
import type { GearSnapshot, InventorySnapshot } from "../types.ts";
import { fetchItemData, peekItemData } from "../xivapi/item-data.ts";
import { getBisSet, fetchSetNames, resolveSetIndex } from "../bis/xivgear.ts";
import { compareGear } from "../bis/comparison.ts";
import { fetchBisLinks } from "../bis/balance.ts";
import { computeNeeds } from "../bis/needs.ts";
import { loadGearAcquisitionMap } from "../acquisition/loader.ts";
import { computeAcquisition } from "../acquisition/compute.ts";
import { logInventorySnapshot, INVENTORY_LOG_ENABLED } from "../debug/inventory-log.ts";
import { parseItemOdr, buildPosMap } from "../dat/itemodr.ts";
import { getFfxivDataDir, findItemodrPath } from "../dat/finder.ts";

const PROJECT_ROOT = path.join(import.meta.dir, "..", "..");


let latestPcapGear: GearSnapshot | null = null;
let latestInventory: InventorySnapshot | null = null;

export function getLatestPcapGear(): GearSnapshot | null {
  return latestPcapGear;
}

export function setLatestPcapGear(snapshot: GearSnapshot): void {
  latestPcapGear = snapshot;
}

export function getLatestInventory(): InventorySnapshot | null {
  return latestInventory;
}

export function setLatestInventory(snapshot: InventorySnapshot): void {
  latestInventory = snapshot;
  void logInventorySnapshot(snapshot);
}

interface WindowControls {
  minimize(): void;
  maximize(): void;
  close(): void;
  getFrame(): { x: number; y: number; width: number; height: number };
  setFrame(x: number, y: number, width: number, height: number): void;
}

let windowControls: WindowControls = {
  minimize: () => {},
  maximize: () => {},
  close: () => {},
  getFrame: () => ({ x: 0, y: 0, width: 1280, height: 900 }),
  setFrame: () => {},
};

export function setWindowControls(controls: WindowControls): void {
  windowControls = controls;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

function notFound(message: string): Response {
  return json({ error: message }, 404);
}


async function serveStatic(pathname: string, publicDir: string): Promise<Response> {
  const filePath = path.join(publicDir, pathname === "/" ? "index.html" : pathname);
  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file);
}

export function startServer(port = 3000, publicDir = path.join(import.meta.dir, "..", "..", "public")): ReturnType<typeof Bun.serve> {
  const server = Bun.serve({
    port,
    async fetch(req) {
      const { pathname } = new URL(req.url);

      if (pathname === "/window/minimize" && req.method === "POST") {
        windowControls.minimize();
        return json({ ok: true });
      }
      if (pathname === "/window/maximize" && req.method === "POST") {
        windowControls.maximize();
        return json({ ok: true });
      }
      if (pathname === "/window/close" && req.method === "POST") {
        windowControls.close();
        return json({ ok: true });
      }
      if (pathname === "/window/frame" && req.method === "GET") {
        return json(windowControls.getFrame());
      }
      if (pathname === "/window/setFrame" && req.method === "POST") {
        const { x, y, width, height } = (await req.json()) as { x: number; y: number; width: number; height: number };
        windowControls.setFrame(x, y, width, height);
        return json({ ok: true });
      }

      // -----------------------------------------------------------------------
      // Item data
      // -----------------------------------------------------------------------

      // GET /item/:id
      //   Returns item metadata from XIVAPI (name, icon, iLevel, materia slots).
      //   Results are cached for the lifetime of the process.
      //
      //   Response: ItemData
      //     { name, icon, itemLevel, materiaSlots, canOvermeld }
      const itemMatch = pathname.match(/^\/item\/(\d+)$/);
      if (itemMatch && req.method === "GET") {
        const itemId = Number(itemMatch[1]);
        return json(await fetchItemData(itemId));
      }

      // -----------------------------------------------------------------------
      // Packet capture
      // -----------------------------------------------------------------------

      // GET  /pcap/gear
      //   Returns the most recent GearSnapshot received from the packet capture
      //   process. 404 if no snapshot has been captured yet.
      //
      //   Response: GearSnapshot
      //     { characterId?, classId?, capturedAt, items: { [slot]: EquipmentPiece } }
      //
      // POST /pcap/gear
      //   Stores a new GearSnapshot (called by the pcap child process).
      //   Body: GearSnapshot
      if (pathname === "/pcap/gear") {
        if (req.method === "GET") {
          const gear = getLatestPcapGear();
          if (!gear) return notFound("No packet-captured gear available yet");
          return json(gear);
        }
        if (req.method === "POST") {
          const body = (await req.json()) as Record<string, unknown>;
          if (typeof body["capturedAt"] !== "string" || typeof body["items"] !== "object" || body["items"] === null) {
            return json({ error: "Invalid GearSnapshot: missing capturedAt or items" }, 400);
          }
          setLatestPcapGear(body as unknown as GearSnapshot);
          return json({ ok: true });
        }
        return json({ error: "Method not allowed" }, 405);
      }

      // GET  /pcap/inventory
      //   Returns the most recent InventorySnapshot (player bags + crystals).
      //   404 if no inventory has been captured yet.
      //
      //   Response: InventorySnapshot
      //     { characterId?, capturedAt, items: InventoryItem[] }
      //     InventoryItem: { itemId, quantity, hq, containerId, slot }
      //
      // POST /pcap/inventory
      //   Stores a new InventorySnapshot (called by the pcap child process).
      if (pathname === "/pcap/inventory") {
        if (req.method === "GET") {
          const inv = getLatestInventory();
          if (!inv) return notFound("No packet-captured inventory available yet");
          return json(inv);
        }
        if (req.method === "POST") {
          const body = (await req.json()) as Record<string, unknown>;
          if (typeof body["capturedAt"] !== "string" || !Array.isArray(body["items"])) {
            return json({ error: "Invalid InventorySnapshot: missing capturedAt or items" }, 400);
          }
          setLatestInventory(body as unknown as InventorySnapshot);
          return json({ ok: true });
        }
        return json({ error: "Method not allowed" }, 405);
      }

      // -----------------------------------------------------------------------
      // BIS (Best-In-Slot) — data sourced from The Balance + xivgear.app
      // -----------------------------------------------------------------------

      // GET /balance/:role/:job
      //   Scrapes The Balance FFXIV for all xivgear.app BIS links for a job.
      //   Includes links embedded as iframes (current-patch sets) and plain
      //   anchor links (prog, ultimates, criterion).
      //
      //   Params:
      //     role  — URL slug used by The Balance, e.g. "tanks", "healers",
      //             "melee", "ranged", "casters"
      //     job   — URL slug used by The Balance, e.g. "warrior", "white-mage"
      //
      //   Response: BisLink[]
      //     [{ label: "2.50 GCD", url: "https://xivgear.app/..." }, ...]
      //
      //   Example: GET /balance/tanks/warrior
      const balanceMatch = pathname.match(/^\/balance\/([^/]+)\/([^/]+)$/);
      if (balanceMatch && req.method === "GET") {
        try {
          const links = await fetchBisLinks(balanceMatch[1], balanceMatch[2]);
          return json(links);
        } catch (e) {
          return json({ error: String(e) }, 502);
        }
      }

      // GET /bis/sets?url=
      //   Lists the available set names for a given xivgear.app URL.
      //   Useful for picking a `set` value before calling /bis or /compare.
      //
      //   Params:
      //     url — a xivgear.app URL (from /balance or typed directly)
      //
      //   Response: string[]
      //     ["2.5", "2.45"]
      //
      //   Example: GET /bis/sets?url=https://xivgear.app/?page=bis|war|current
      if (pathname === "/bis/sets" && req.method === "GET") {
        const xivgearUrl = new URL(req.url).searchParams.get("url");
        if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
        try {
          return json(await fetchSetNames(xivgearUrl));
        } catch (e) {
          return json({ error: String(e) }, 502);
        }
      }

      // GET /bis?url=&set=
      //   Fetches and returns a normalized BIS gear set from xivgear.app.
      //   Results are cached in-memory by (url, set) for the lifetime of the process.
      //
      //   Params:
      //     url — a xivgear.app URL (from /balance or typed directly)
      //     set — (optional) set name (e.g. "2.5") or 0-based index (e.g. "0").
      //           Defaults to selectedIndex in the URL, then 0.
      //
      //   Response: BisGearSet
      //     { name, job, source, foodId?, items: { [slot]: BisItem } }
      //     BisItem: { itemId, materias: number[] }
      //
      //   Example: GET /bis?url=https://xivgear.app/?page=bis|war|current&set=2.5
      if (pathname === "/bis" && req.method === "GET") {
        const params = new URL(req.url).searchParams;
        const xivgearUrl = params.get("url");
        if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
        const setParam = params.get("set") ?? undefined;
        try {
          const setIndex = await resolveSetIndex(xivgearUrl, setParam);
          return json(await getBisSet(xivgearUrl, setIndex));
        } catch (e) {
          return json({ error: String(e) }, 502);
        }
      }

      // GET /compare?url=&set=
      //   Compares the most recently captured gear snapshot against a BIS set.
      //   Returns 409 if no gear has been captured yet.
      //
      //   Params:
      //     url — a xivgear.app URL (same as /bis)
      //     set — (optional) set name or 0-based index (same as /bis)
      //
      //   Response: GearsetComparison
      //     {
      //       matchCount, wrongItemCount, wrongMateriaCount, missingCount,
      //       slots: [{
      //         slot, status,           // status: match | wrong-item | wrong-materia | missing | bis-empty
      //         equippedItemId?, bisItemId?,
      //         equippedMaterias?, bisMaterias?
      //       }]
      //     }
      //
      //   Example: GET /compare?url=https://xivgear.app/?page=bis|war|current&set=2.5
      if (pathname === "/compare" && req.method === "GET") {
        const params = new URL(req.url).searchParams;
        const xivgearUrl = params.get("url");
        if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
        const gear = getLatestPcapGear();
        if (!gear) return json({ error: "No packet-captured gear available yet" }, 409);
        const setParam = params.get("set") ?? undefined;
        try {
          const setIndex = await resolveSetIndex(xivgearUrl, setParam);
          return json(compareGear(gear, await getBisSet(xivgearUrl, setIndex)));
        } catch (e) {
          return json({ error: String(e) }, 502);
        }
      }

      // GET /needs?url=&set=
      //   Returns what the player still needs to obtain or re-meld to complete a
      //   BIS set, cross-referenced against the current inventory snapshot.
      //   Returns 409 if no gear has been captured yet.
      //
      //   Params:
      //     url — a xivgear.app URL (same as /compare)
      //     set — (optional) set name or 0-based index (same as /compare)
      //
      //   Response: GearNeeds
      //     {
      //       itemNeeds: [{
      //         slot, reason,           // reason: wrong-item | missing
      //         bisItemId, equippedItemId?,
      //         quantityInBags          // how many you already have in your bags
      //       }],
      //       materiaChanges: [{
      //         slot, bisItemId,
      //         toAdd,                  // materia item IDs to meld
      //         toRemove,               // materia item IDs to strip first
      //         quantityInBags          // { materiaItemId: count } for toAdd items
      //       }]
      //     }
      //
      //   Example: GET /needs?url=https://xivgear.app/?page=bis|war|current&set=2.5
      if (pathname === "/needs" && req.method === "GET") {
        const params = new URL(req.url).searchParams;
        const xivgearUrl = params.get("url");
        if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
        const gear = getLatestPcapGear();
        if (!gear) return json({ error: "No packet-captured gear available yet" }, 409);
        const setParam = params.get("set") ?? undefined;
        try {
          const setIndex = await resolveSetIndex(xivgearUrl, setParam);
          const bisSet = await getBisSet(xivgearUrl, setIndex);
          const comparison = compareGear(gear, bisSet);
          return json(computeNeeds(comparison, bisSet, getLatestInventory()));
        } catch (e) {
          return json({ error: String(e) }, 502);
        }
      }

      // GET /debug/inventory
      //   Returns the current inventory snapshot grouped by container and sorted
      //   in the same visual order the player sees in-game, using ITEMODR.DAT.
      //   One entry per occupied slot; location is 1-based visual position.
      //   Names are resolved from the in-process XIVAPI cache (no network call).
      //
      //   Response: { odrLoaded, capturedAt?, byContainer: { [label]: Item[] } }
      //     Item: { itemId, quantity, hq, location, name? }
      if (pathname === "/debug/inventory" && req.method === "GET") {
        const inv = getLatestInventory();
        if (!inv) return json({ odrLoaded: false, byContainer: {} });

        // Load ITEMODR.DAT fresh on each call so moves are reflected immediately
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

        // Container id → display group label
        const CONTAINER_GROUP: Record<number, string> = {
          0: "Bags", 1: "Bags", 2: "Bags", 3: "Bags",
          2000: "Currency", 2001: "Crystals",
          3500: "Armory: Main-hand", 3200: "Armory: Off-hand",
          3201: "Armory: Head",  3202: "Armory: Body",  3203: "Armory: Hands",
          3205: "Armory: Legs",  3206: "Armory: Feet",
          3207: "Armory: Neck",  3208: "Armory: Ears",  3209: "Armory: Wrists",
          3300: "Armory: Rings", 3400: "Armory: Soul Crystal",
        };

        // Preferred display order for groups
        const GROUP_ORDER = [
          "Bags", "Currency", "Crystals",
          "Armory: Main-hand", "Armory: Off-hand",
          "Armory: Head", "Armory: Body", "Armory: Hands",
          "Armory: Legs", "Armory: Feet",
          "Armory: Neck", "Armory: Ears", "Armory: Wrists",
          "Armory: Rings", "Armory: Soul Crystal",
        ];

        // Build one display entry per slot — no aggregation, so location is exact.
        // location is 1-based visual position from ODR (null when ODR not loaded).
        type DisplayEntry = {
          group: string; itemId: number; quantity: number; hq: boolean; location: number | null;
        };
        const entries: DisplayEntry[] = inv.items.map(item => {
          const group = CONTAINER_GROUP[item.containerId] ?? `Container ${item.containerId}`;
          const rawPos = posMap.get(`${item.containerId}:${item.slot}`);
          return {
            group,
            itemId: item.itemId,
            quantity: item.quantity,
            hq: item.hq,
            location: rawPos !== undefined ? rawPos + 1 : null,
          };
        });

        // Sort by group order, then by location (null locations go to end)
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

      // GET /acquisition?url=&set=
      //   Returns acquisition paths (coffer, books, upgrade) for each slot
      //   that still needs to be obtained, cross-referenced against the current
      //   inventory (bags + armory).  Returns 409 if no gear has been captured.
      //
      //   Response: SlotAcquisitionStatus[]
      //     [{
      //       slot, bisItemId, canAcquireNow,
      //       coffer?: { coffer: ItemCount, available },
      //       books?:  { book: ItemCount, available },
      //       upgrade?: { upgradeItemId, base: BaseItemStatus, material: UpgradeMaterialStatus, available }
      //     }]
      if (pathname === "/acquisition" && req.method === "GET") {
        const params = new URL(req.url).searchParams;
        const xivgearUrl = params.get("url");
        if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
        const gear = getLatestPcapGear();
        if (!gear) return json({ error: "No packet-captured gear available yet" }, 409);
        const setParam = params.get("set") ?? undefined;
        try {
          const setIndex = await resolveSetIndex(xivgearUrl, setParam);
          const bisSet = await getBisSet(xivgearUrl, setIndex);
          const comparison = compareGear(gear, bisSet);
          const gearNeeds = computeNeeds(comparison, bisSet, getLatestInventory());
          const acquisitionMap = await loadGearAcquisitionMap(PROJECT_ROOT);
          return json(computeAcquisition(gearNeeds, acquisitionMap, getLatestInventory()));
        } catch (e) {
          return json({ error: String(e) }, 502);
        }
      }

      return serveStatic(pathname, publicDir);
    },
  });
  console.log(`Listening on http://localhost:${port}`);
  return server;
}

// Standalone entry point: bun run src/server/index.ts
if (import.meta.main) {
  const port = Number(process.env["PORT"] ?? 3000);
  startServer(port);
}
