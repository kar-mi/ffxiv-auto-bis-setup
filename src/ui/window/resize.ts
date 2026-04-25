const MIN_W = 480;
const MIN_H = 320;

const NEEDS_POSITION = new Set(["n", "w", "nw", "ne", "sw"]);

interface ResizeState {
  dir: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  startWinX: number;
  startWinY: number;
  pendingX: number;
  pendingY: number;
  pendingW: number;
  pendingH: number;
  dirty: boolean;
}

let resizeState: ResizeState | null = null;
let resizeRafId: number | null = null;
let resizeAbort: AbortController | null = null;

function flushResize(): void {
  resizeRafId = null;
  if (!resizeState?.dirty) return;
  resizeState.dirty = false;

  resizeAbort?.abort();
  resizeAbort = new AbortController();

  fetch("/window/setFrame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x: resizeState.pendingX,
      y: resizeState.pendingY,
      width: resizeState.pendingW,
      height: resizeState.pendingH,
    }),
    signal: resizeAbort.signal,
  }).catch(err => { if ((err as Error).name !== "AbortError") console.error("[resize]", err); });
}

export function initResize(): void {
  document.querySelectorAll<HTMLElement>("[data-dir]").forEach(handle => {
    handle.addEventListener("pointerdown", e => {
      e.preventDefault();
      const dir = handle.dataset["dir"]!;

      if (!NEEDS_POSITION.has(dir)) {
        resizeState = {
          dir,
          startX: e.clientX, startY: e.clientY,
          startW: window.innerWidth, startH: window.innerHeight,
          startWinX: 0, startWinY: 0,
          pendingX: 0, pendingY: 0,
          pendingW: window.innerWidth, pendingH: window.innerHeight,
          dirty: false,
        };
        handle.setPointerCapture(e.pointerId);
      } else {
        fetch("/window/frame")
          .then(r => r.json())
          .then((frame: { x: number; y: number; width: number; height: number }) => {
            resizeState = {
              dir,
              startX: e.clientX, startY: e.clientY,
              startW: frame.width, startH: frame.height,
              startWinX: frame.x, startWinY: frame.y,
              pendingX: frame.x, pendingY: frame.y,
              pendingW: frame.width, pendingH: frame.height,
              dirty: false,
            };
            handle.setPointerCapture(e.pointerId);
          })
          .catch(console.error);
      }
    });
  });

  document.addEventListener("pointermove", e => {
    if (!resizeState) return;
    const { dir, startX, startY, startW, startH, startWinX, startWinY } = resizeState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let x = startWinX, y = startWinY, w = startW, h = startH;
    if (dir.includes("e")) w = Math.max(MIN_W, startW + dx);
    if (dir.includes("s")) h = Math.max(MIN_H, startH + dy);
    if (dir.includes("w")) { w = Math.max(MIN_W, startW - dx); x = startWinX + (startW - w); }
    if (dir.includes("n")) { h = Math.max(MIN_H, startH - dy); y = startWinY + (startH - h); }

    resizeState.pendingX = x;
    resizeState.pendingY = y;
    resizeState.pendingW = w;
    resizeState.pendingH = h;
    resizeState.dirty = true;

    if (!resizeRafId) resizeRafId = requestAnimationFrame(flushResize);
  });

  document.addEventListener("pointerup", () => {
    if (resizeRafId) { cancelAnimationFrame(resizeRafId); resizeRafId = null; }
    resizeAbort?.abort();
    resizeAbort = null;
    resizeState = null;
  });
}
