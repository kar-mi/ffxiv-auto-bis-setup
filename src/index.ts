import { fetchCharacterGear } from "./lodestone.ts";
import { readCharacter, writeCharacter } from "./storage.ts";
import type { GearSnapshot } from "./types.ts";

export let latestPcapGear: GearSnapshot | null = null;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

function notFound(message: string): Response {
  return json({ error: message }, 404);
}

function serverError(message: string): Response {
  return json({ error: message }, 500);
}

async function getUser(lodestoneId: string): Promise<Response> {
  const cached = await readCharacter(lodestoneId);
  if (!cached) {
    return notFound(`No data for character ${lodestoneId} — call POST /user/${lodestoneId} to fetch it`);
  }
  return json(cached);
}

async function updateUser(lodestoneId: string): Promise<Response> {
  const character = await fetchCharacterGear(lodestoneId);
  await writeCharacter(lodestoneId, character);
  return json(character);
}

async function serveStatic(pathname: string): Promise<Response> {
  const filePath = `public${pathname === "/" ? "/index.html" : pathname}`;
  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file);
}

export function startServer(port = 3000): ReturnType<typeof Bun.serve> {
  const server = Bun.serve({
    port,
    async fetch(req) {
      const { pathname } = new URL(req.url);

      const userMatch = pathname.match(/^\/user\/(\d+)$/);
      if (userMatch) {
        const lodestoneId = userMatch[1];
        try {
          if (req.method === "GET") return await getUser(lodestoneId);
          if (req.method === "POST") return await updateUser(lodestoneId);
          return json({ error: "Method not allowed" }, 405);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return serverError(message);
        }
      }

      if (pathname === "/pcap/gear") {
        if (req.method === "GET") {
          if (!latestPcapGear) return notFound("No packet-captured gear available yet");
          return json(latestPcapGear);
        }
        if (req.method === "POST") {
          latestPcapGear = (await req.json()) as GearSnapshot;
          return json({ ok: true });
        }
        return json({ error: "Method not allowed" }, 405);
      }

      return serveStatic(pathname);
    },
  });
  console.log(`Listening on http://localhost:${port}`);
  return server;
}

// Standalone entry point: bun run src/index.ts
if (import.meta.main) {
  const port = Number(process.env["PORT"] ?? 3000);
  startServer(port);
}
