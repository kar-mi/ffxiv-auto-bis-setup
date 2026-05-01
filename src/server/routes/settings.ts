import type { AppSettings } from "../../types.ts";
import type { ServerCtx } from "../ctx.ts";
import { json } from "../helpers.ts";
import {
  isAppDefaultTab,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from "../../settings/store.ts";

export async function tryHandle(req: Request, ctx: ServerCtx): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (pathname !== "/settings") return null;

  if (req.method === "GET") {
    return json(await loadSettings(ctx.projectRoot));
  }

  if (req.method === "PUT") {
    const body = await req.json() as Partial<AppSettings>;
    if (body.defaultTab !== undefined && !isAppDefaultTab(body.defaultTab)) {
      return json({ error: `Invalid defaultTab "${String(body.defaultTab)}"` }, 400);
    }

    const current = await loadSettings(ctx.projectRoot);
    const next = normalizeSettings({ ...current, ...body });
    await saveSettings(ctx.projectRoot, next);
    return json(next);
  }

  return json({ error: "Method not allowed" }, 405);
}
