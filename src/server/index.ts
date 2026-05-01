import path from "path";
import type { GearSnapshot, InventorySnapshot } from "../types.ts";
import { logInventorySnapshot } from "../debug/inventory-log.ts";
import {
  loadGearCache, saveGearCache, loadInventoryCache, saveInventoryCache,
  saveJobGearCache, loadJobGearCache as _loadJobGearCache,
} from "../pcap/snapshot-cache.ts";
import { withPcapWarning } from "../pcap/status.ts";
import type { PcapStatus } from "../pcap/status.ts";
import type { ServerCtx, WindowControls } from "./ctx.ts";
import * as windowRoute     from "./routes/window.ts";
import * as pcapRoute       from "./routes/pcap.ts";
import * as itemRoute       from "./routes/item.ts";
import * as bisRoute        from "./routes/bis.ts";
import * as acquisitionRoute from "./routes/acquisition.ts";
import * as debugRoute      from "./routes/debug.ts";

let PROJECT_ROOT = path.join(import.meta.dir, "..", "..");

let latestPcapGear: GearSnapshot | null = null;
let latestInventory: InventorySnapshot | null = null;
let gearIsLive = false;
let inventoryIsLive = false;
let selectedGear: GearSnapshot | null = null;
let pcapStatus: PcapStatus = {
  phase: "unavailable",
  updatedAt: new Date().toISOString(),
  message: "Packet capture is only available in desktop mode.",
};

export function getLatestPcapGear(): GearSnapshot | null { return latestPcapGear; }
export function getLatestInventory(): InventorySnapshot | null { return latestInventory; }
export function getPcapStatus(): PcapStatus { return withPcapWarning(pcapStatus); }

export function setPcapStatus(update: Partial<Omit<PcapStatus, "updatedAt" | "warning">>): void {
  pcapStatus = {
    ...pcapStatus,
    ...update,
    updatedAt: new Date().toISOString(),
  };
}

export function markPcapNetworkData(): void {
  setPcapStatus({ lastNetworkAt: new Date().toISOString() });
}

export function setLatestPcapGear(snapshot: GearSnapshot): void {
  latestPcapGear = snapshot;
  selectedGear = snapshot;
  gearIsLive = true;
  setPcapStatus({ phase: "live", lastSnapshotAt: snapshot.capturedAt, message: undefined });
  void saveGearCache(PROJECT_ROOT, snapshot);
  if (snapshot.classId !== undefined) void saveJobGearCache(PROJECT_ROOT, snapshot.classId, snapshot);
}

export function setLatestInventory(snapshot: InventorySnapshot): void {
  latestInventory = snapshot;
  inventoryIsLive = true;
  setPcapStatus({ phase: "live", lastSnapshotAt: snapshot.capturedAt, message: undefined });
  void saveInventoryCache(PROJECT_ROOT, snapshot);
  void logInventorySnapshot(snapshot);
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

async function serveStatic(pathname: string, publicDir: string): Promise<Response> {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolvedPublic = path.resolve(publicDir);
  const filePath = path.resolve(resolvedPublic, "." + requested);
  if (!filePath.startsWith(resolvedPublic + path.sep) && filePath !== resolvedPublic) {
    return new Response("Not found", { status: 404 });
  }
  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file);
}

const ROUTES = [windowRoute, pcapRoute, itemRoute, bisRoute, acquisitionRoute, debugRoute];

export async function startServer(
  port = 3000,
  publicDir = path.join(import.meta.dir, "..", "..", "public"),
  projectRoot?: string,
): Promise<ReturnType<typeof Bun.serve>> {
  if (projectRoot) PROJECT_ROOT = projectRoot;

  await Promise.all([
    loadGearCache(PROJECT_ROOT).then(g => { if (g && !latestPcapGear) latestPcapGear = g; }),
    loadInventoryCache(PROJECT_ROOT).then(i => { if (i && !latestInventory) latestInventory = i; }),
  ]);

  const ctx: ServerCtx = {
    get projectRoot() { return PROJECT_ROOT; },
    getLatestPcapGear: () => latestPcapGear,
    setLatestPcapGear,
    getSelectedGear: () => selectedGear ?? latestPcapGear,
    setSelectedGear: (snap) => { selectedGear = snap; },
    getLatestInventory: () => latestInventory,
    setLatestInventory,
    isGearLive: () => gearIsLive,
    isInventoryLive: () => inventoryIsLive,
    getPcapStatus,
    get windowControls() { return windowControls; },
  };

  const server = Bun.serve({
    port,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      for (const route of ROUTES) {
        const res = await route.tryHandle(req, ctx);
        if (res) return res;
      }
      return serveStatic(pathname, publicDir);
    },
  });
  console.log(`Listening on http://localhost:${port}`);
  return server;
}

if (import.meta.main) {
  const port = Number(process.env["PORT"] ?? 3000);
  await startServer(port);
}
