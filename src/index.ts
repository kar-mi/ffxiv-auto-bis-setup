import { fetchCharacterGear } from "./lodestone.ts";
import { readCharacter, writeCharacter } from "./storage.ts";

const PORT = 3000;

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

Bun.serve({
  port: PORT,
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

    return serveStatic(pathname);
  },
});

console.log(`Listening on http://localhost:${PORT}`);
