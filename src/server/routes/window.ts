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
    const body = (await req.json()) as Partial<Record<"x" | "y" | "width" | "height", unknown>>;
    const nums = ["x", "y", "width", "height"] as const;
    if (nums.some(k => typeof body[k] !== "number" || !Number.isFinite(body[k] as number))) {
      return json({ error: "x, y, width, height must be finite numbers" }, 400);
    }
    const { x, y, width, height } = body as Record<typeof nums[number], number>;
    if (width <= 0 || height <= 0) return json({ error: "width and height must be positive" }, 400);
    ctx.windowControls.setFrame(x, y, width, height);
    return json({ ok: true });
  }

  return null;
}
