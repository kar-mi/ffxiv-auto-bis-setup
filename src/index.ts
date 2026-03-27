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
