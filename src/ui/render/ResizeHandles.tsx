import { windowMaximized } from "./Titlebar.tsx";
import { startResize } from "../window/resize.ts";

export function ResizeHandles() {
  if (windowMaximized.value) return null;
  return (
    <>
      <div class="resize-handle resize-edge-n"        onPointerDown={(e) => startResize("n",  e as PointerEvent)} />
      <div class="resize-handle resize-edge-s"        onPointerDown={(e) => startResize("s",  e as PointerEvent)} />
      <div class="resize-handle resize-edge-e"        onPointerDown={(e) => startResize("e",  e as PointerEvent)} />
      <div class="resize-handle resize-edge-w"        onPointerDown={(e) => startResize("w",  e as PointerEvent)} />
      <div class="resize-handle resize-corner resize-corner-nw" onPointerDown={(e) => startResize("nw", e as PointerEvent)} />
      <div class="resize-handle resize-corner resize-corner-ne" onPointerDown={(e) => startResize("ne", e as PointerEvent)} />
      <div class="resize-handle resize-corner resize-corner-sw" onPointerDown={(e) => startResize("sw", e as PointerEvent)} />
      <div class="resize-handle resize-corner resize-corner-se" onPointerDown={(e) => startResize("se", e as PointerEvent)} />
    </>
  );
}
