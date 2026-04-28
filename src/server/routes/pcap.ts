import type { GearSnapshot, InventorySnapshot } from '../../types.ts';
import type { ServerCtx } from '../ctx.ts';
import { json, notFound } from '../helpers.ts';
import { listJobGearCaches, loadJobGearCache } from '../../pcap/snapshot-cache.ts';

function validateSnapshotBody(body: Record<string, unknown>, kind: "Gear" | "Inventory"): Response | null {
  if (typeof body["capturedAt"] !== "string") {
    return json({ error: `Invalid ${kind}Snapshot: missing capturedAt` }, 400);
  }
  if (kind === "Inventory") {
    if (!Array.isArray(body["items"])) {
      return json({ error: "Invalid InventorySnapshot: items must be an array" }, 400);
    }
  } else {
    if (typeof body["items"] !== "object" || body["items"] === null) {
      return json({ error: "Invalid GearSnapshot: missing items" }, 400);
    }
  }
  return null;
}

export async function tryHandle(req: Request, ctx: ServerCtx): Promise<Response | null> {
  const { pathname } = new URL(req.url);

  if (pathname === "/pcap/gear") {
    if (req.method === "GET") {
      const gear = ctx.getLatestPcapGear();
      if (!gear) return notFound("No packet-captured gear available yet");
      return json({ ...gear, fromCache: !ctx.isGearLive() });
    }
    if (req.method === "POST") {
      const body = (await req.json()) as Record<string, unknown>;
      const err = validateSnapshotBody(body, "Gear");
      if (err) return err;
      ctx.setLatestPcapGear(body as unknown as GearSnapshot);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  }

  if (pathname === "/pcap/inventory") {
    if (req.method === "GET") {
      const inv = ctx.getLatestInventory();
      if (!inv) return notFound("No packet-captured inventory available yet");
      return json({ ...inv, fromCache: !ctx.isInventoryLive() });
    }
    if (req.method === "POST") {
      const body = (await req.json()) as Record<string, unknown>;
      const err = validateSnapshotBody(body, "Inventory");
      if (err) return err;
      ctx.setLatestInventory(body as unknown as InventorySnapshot);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  }

  if (pathname === "/pcap/gear-cache" && req.method === "GET") {
    return json(await listJobGearCaches(ctx.projectRoot));
  }

  const jobCacheMatch = pathname.match(/^\/pcap\/gear-cache\/(\d+)$/);
  if (jobCacheMatch && req.method === "GET") {
    const classId = Number(jobCacheMatch[1]);
    const snap = await loadJobGearCache(ctx.projectRoot, classId);
    if (!snap) return notFound(`No cached gear for classId ${classId}`);
    return json({ ...snap, fromCache: true });
  }

  if (pathname === "/pcap/gear-selected" && req.method === "POST") {
    const body = (await req.json()) as Record<string, unknown>;
    const err = validateSnapshotBody(body, "Gear");
    if (err) return err;
    ctx.setSelectedGear(body as unknown as GearSnapshot);
    return json({ ok: true });
  }

  return null;
}
