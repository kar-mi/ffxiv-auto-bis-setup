import path from "path";
import type { GearSnapshot, BisGearSet } from "../types.ts";
import { fetchItemData } from "../xivapi/item-data.ts";
import { fetchBisSet, fetchSetNames, resolveSetIndex } from "../bis/xivgear.ts";
import { compareGear } from "../bis/comparison.ts";
import { fetchBisLinks } from "../bis/balance.ts";


let latestPcapGear: GearSnapshot | null = null;
const bisCache = new Map<string, BisGearSet>();

export function getLatestPcapGear(): GearSnapshot | null {
  return latestPcapGear;
}

export function setLatestPcapGear(snapshot: GearSnapshot): void {
  latestPcapGear = snapshot;
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
          setLatestPcapGear((await req.json()) as GearSnapshot);
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
      //     BisItem: { itemId, slot, materias: number[] }
      //
      //   Example: GET /bis?url=https://xivgear.app/?page=bis|war|current&set=2.5
      if (pathname === "/bis" && req.method === "GET") {
        const params = new URL(req.url).searchParams;
        const xivgearUrl = params.get("url");
        if (!xivgearUrl) return json({ error: "Missing ?url= parameter" }, 400);
        const setParam = params.get("set") ?? undefined;
        try {
          const setIndex = await resolveSetIndex(xivgearUrl, setParam);
          const cacheKey = `${xivgearUrl}#${setIndex}`;
          if (!bisCache.has(cacheKey)) {
            bisCache.set(cacheKey, await fetchBisSet(xivgearUrl, setIndex));
          }
          return json(bisCache.get(cacheKey)!);
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
          const cacheKey = `${xivgearUrl}#${setIndex}`;
          if (!bisCache.has(cacheKey)) {
            bisCache.set(cacheKey, await fetchBisSet(xivgearUrl, setIndex));
          }
          return json(compareGear(gear, bisCache.get(cacheKey)!));
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
