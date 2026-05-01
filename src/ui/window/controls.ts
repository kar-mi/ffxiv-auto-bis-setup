import { logger } from "../dom.ts";

const post = (path: string): Promise<void> =>
  fetch(path, { method: "POST" }).then(() => undefined).catch(e => logger.error(e, `[window] ${path}`));

export const minimizeWindow = (): Promise<void> => post("/window/minimize");
export const toggleMaximizeWindow = (): Promise<void> => post("/window/maximize");
export const closeWindow = (): Promise<void> => post("/window/close");

export async function getWindowFrame(): Promise<{ x: number; y: number; width: number; height: number }> {
  const r = await fetch("/window/frame");
  return r.json() as Promise<{ x: number; y: number; width: number; height: number }>;
}

export async function setWindowFrame(x: number, y: number, width: number, height: number): Promise<void> {
  await fetch("/window/setFrame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y, width, height }),
  });
}
