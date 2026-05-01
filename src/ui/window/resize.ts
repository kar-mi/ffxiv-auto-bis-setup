import { windowMaximized } from "../render/Titlebar.tsx";
import { getWindowFrame, setWindowFrame } from "./controls.ts";

type Edge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;

export function startMove(e: PointerEvent): void {
  if (windowMaximized.value) return;
  if ((e.target as HTMLElement).closest("button")) return;

  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);

  const startX = e.screenX;
  const startY = e.screenY;

  let initialFrame: { x: number; y: number; width: number; height: number } | null = null;
  let rafScheduled = false;
  let lastScreenX = startX;
  let lastScreenY = startY;

  void getWindowFrame().then(frame => { initialFrame = frame; });

  function onPointerMove(ev: PointerEvent): void {
    if (!initialFrame) return;
    lastScreenX = ev.screenX;
    lastScreenY = ev.screenY;
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      const frame = initialFrame;
      if (!frame) return;
      const dx = lastScreenX - startX;
      const dy = lastScreenY - startY;
      void setWindowFrame(frame.x + dx, frame.y + dy, frame.width, frame.height);
    });
  }

  function cleanup(): void {
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", cleanup);
    el.removeEventListener("pointercancel", cleanup);
  }

  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", cleanup);
  el.addEventListener("pointercancel", cleanup);
}

export function startResize(edge: Edge, e: PointerEvent): void {
  if (windowMaximized.value) return;

  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);

  const startX = e.screenX;
  const startY = e.screenY;

  let initialFrame: { x: number; y: number; width: number; height: number } | null = null;
  let rafScheduled = false;
  let lastScreenX = startX;
  let lastScreenY = startY;

  void getWindowFrame().then(frame => { initialFrame = frame; });

  function onPointerMove(ev: PointerEvent): void {
    if (!initialFrame) return;
    lastScreenX = ev.screenX;
    lastScreenY = ev.screenY;
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      const frame = initialFrame;
      if (!frame) return;
      const dx = lastScreenX - startX;
      const dy = lastScreenY - startY;
      let { x, y, width, height } = frame;
      if (edge.includes("e")) width  = Math.max(MIN_WIDTH,  width  + dx);
      if (edge.includes("s")) height = Math.max(MIN_HEIGHT, height + dy);
      if (edge.includes("w")) {
        const newWidth = Math.max(MIN_WIDTH, width - dx);
        x += width - newWidth;
        width = newWidth;
      }
      if (edge.includes("n")) {
        const newHeight = Math.max(MIN_HEIGHT, height - dy);
        y += height - newHeight;
        height = newHeight;
      }
      void setWindowFrame(x, y, width, height);
    });
  }

  function cleanup(): void {
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", cleanup);
    el.removeEventListener("pointercancel", cleanup);
  }

  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", cleanup);
  el.addEventListener("pointercancel", cleanup);
}
