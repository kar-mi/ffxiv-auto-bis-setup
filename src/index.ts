import path from "path";
import type { GearSnapshot } from "./types.ts";


let latestPcapGear: GearSnapshot | null = null;

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

export function startServer(port = 3000, publicDir = path.join(import.meta.dir, "..", "public")): ReturnType<typeof Bun.serve> {
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

      return serveStatic(pathname, publicDir);
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
