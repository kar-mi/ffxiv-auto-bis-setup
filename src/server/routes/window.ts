import type { ServerCtx } from '../ctx.ts';
import { json } from '../helpers.ts';

export async function tryHandle(req: Request, ctx: ServerCtx): Promise<Response | null> {
  const { pathname } = new URL(req.url);

  if (pathname === "/window/minimize" && req.method === "POST") {
    ctx.windowControls.minimize();
    return json({ ok: true });
  }
  if (pathname === "/window/maximize" && req.method === "POST") {
    ctx.windowControls.maximize();
    return json({ ok: true });
  }
  if (pathname === "/window/close" && req.method === "POST") {
    ctx.windowControls.close();
    return json({ ok: true });
  }
  if (pathname === "/window/frame" && req.method === "GET") {
    return json(ctx.windowControls.getFrame());
  }
  if (pathname === "/window/setFrame" && req.method === "POST") {
    const { x, y, width, height } = (await req.json()) as { x: number; y: number; width: number; height: number };
    ctx.windowControls.setFrame(x, y, width, height);
    return json({ ok: true });
  }

  return null;
}
