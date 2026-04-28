import type { ServerCtx } from '../ctx.ts';
import { json } from '../helpers.ts';
import { fetchItemData } from '../../xivapi/item-data.ts';

export async function tryHandle(req: Request, _ctx: ServerCtx): Promise<Response | null> {
  const { pathname } = new URL(req.url);

  const itemMatch = pathname.match(/^\/item\/(\d+)$/);
  if (itemMatch && req.method === "GET") {
    const itemId = Number(itemMatch[1]);
    return json(await fetchItemData(itemId));
  }

  return null;
}
