# Custom Titlebar + Resize for Electrobun Window

## Context

The app originally ran as an Electrobun desktop window using **native Windows chrome** (`titleBarStyle: "default"` in `src/desktop/index.ts`). The native bar clashed with the FFXIV-arcane interior — Cinzel + Share Tech Mono on `#0d0d0d`/`#1a1a2e` panels with `#c8a84b` gold accents and decorative corner spans.

Goal: replace native window chrome with a custom titlebar + custom resize handles that extend the existing aesthetic. The backend exposes everything needed (`/window/minimize`, `/window/maximize`, `/window/close`, `/window/setFrame`, `/window/frame`), and the implemented Windows-safe configuration keeps the native window opaque for reliable WebView2 hit-testing.

## Aesthetic Direction

Extend the existing FFXIV-arcane language; do not introduce a new vocabulary.

- **Titlebar bar**: 32px tall, `bg-ffxiv-panel` (`#1a1a2e`) base with a 1px gold/15% bottom hairline (matches the `tab bar` border at `App.tsx:91`).
- **Left**: a 14px diamond/rhombus emblem (SVG) drawn in `#c8a84b` line-weight, followed by `FFXIV  GEAR  SETUP` in Cinzel 600, 11px, letter-spacing 0.18em, color `text-gray-300`. Two-space gaps between words to evoke title plates.
- **Center**: drag region (covers the whole bar except the emblem strip and controls). No visible chrome; only the cursor changes.
- **Right (window controls)**: three 46×32 buttons.
  - Glyphs as SVG strokes (1.25px line, gold `#c8a84b` at 70% opacity).
  - Hover: glyph to full gold + subtle 4% gold background fill + 1px gold corner accents (reuse the `Corners` component pattern from `src/ui/components/Corners.tsx`).
  - Close button hover background: `rgba(220,38,38,0.18)` with red-300 glyph (matches existing red status glow at `styles.css:53-54`).
  - Maximize button toggles its glyph between a single square and overlapping squares based on a `windowMaximized` signal.
- **Decorative corner spans**: tiny 4px gold corner accents at the very top-left and top-right of the *titlebar* (not the buttons), opacity 0.4 — echoes `Corners.tsx`.

## Implemented Files

### `src/desktop/index.ts:80-86` — switch to frameless opaque window
```ts
const win = new BrowserWindow({
  title: "FFXIV Gear Setup",
  url: `http://localhost:${SERVER_PORT}`,
  frame: savedState,
  titleBarStyle: "hidden",      // was "default"
  transparent: false,
});
```
This activates the `Titled: false, FullSizeContentView: true` styleMask path in `node_modules/electrobun/dist-win-x64/api/bun/core/BrowserWindow.ts:201-206`. Keep the native window opaque on Windows: `transparent: true` causes WebView2 hit-testing to remain stuck at the original window size after custom `setFrame` resize operations.

After creating the window, call `DwmSetWindowAttribute(DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND)` as a best-effort Windows 11 native rounding hint. This may be ignored by Windows for heavily customized frameless windows, so the HTML shell must not depend on transparency for its shape.

### `public/index.html:35` — keep the app shell square
Remove `rounded-xl` from `#app-shell`. With an opaque native window, an inner rounded shell exposes the square native window behind it, creating a visible double-corner artifact. Let DWM own any real outer rounding; if DWM declines, the app should look intentionally square.

### `src/ui/styles.css` — use a dark opaque page backdrop
With `transparent: false`, the window remains opaque even when DWM rounds the native outer corners. Set `html, body` to the app dark color (`#0d0d0d`) rather than `transparent`; otherwise the opaque native window can show a white fill around the app surface. True desktop-transparent corners are intentionally avoided to preserve reliable WebView2 input on Windows.

### `src/ui/render/App.tsx:425-439` — add Titlebar + ResizeHandles to the App tree
Insert `<Titlebar />` above `<TabBar />` and mount `<ResizeHandles />` as a sibling. The existing top-level `flex flex-col` ensures the titlebar sits above the tab bar.

```tsx
export function App() {
  return (
    <>
      <Titlebar />
      <TabBar />
      <div class="flex-1 overflow-y-auto pb-2">
        {/* …existing tab panels… */}
      </div>
      <CompareModal />
      <SettingsModal />
      <ResizeHandles />
    </>
  );
}
```

### `src/ui/styles.css` — add titlebar + resize styles
Append a new section at the bottom:

```css
/* ---- Window chrome ---- */
.titlebar { -webkit-app-region: drag; user-select: none; }
.titlebar .no-drag,
.titlebar button { -webkit-app-region: no-drag; }

/* ---- Resize handles ---- */
.resize-handle { position: fixed; z-index: 1000; -webkit-app-region: no-drag; }
.resize-edge-n, .resize-edge-s { left: 8px; right: 8px; height: 4px; cursor: ns-resize; }
.resize-edge-e, .resize-edge-w { top: 8px; bottom: 8px; width: 4px; cursor: ew-resize; }
.resize-edge-n { top: 0; }
.resize-edge-s { bottom: 0; }
.resize-edge-e { right: 0; }
.resize-edge-w { left: 0; }
.resize-corner { width: 10px; height: 10px; }
.resize-corner-nw { top: 0; left: 0; cursor: nwse-resize; }
.resize-corner-ne { top: 0; right: 0; cursor: nesw-resize; }
.resize-corner-sw { bottom: 0; left: 0; cursor: nesw-resize; }
.resize-corner-se { bottom: 0; right: 0; cursor: nwse-resize; }
```

Note: when the window is maximized, the `<ResizeHandles />` component returns `null` (no resize while maximized).

### `src/ui/render/App.tsx:110-115` — keep Settings button
Settings button stays where it is on the tab bar. The titlebar only carries window controls (min/max/close), not Settings — keeping Settings adjacent to the tabs preserves muscle memory.

## New Files

### `src/ui/window/controls.ts` — window control HTTP wrappers
```ts
import { logger } from "../dom.ts";
const post = (path: string): Promise<void> =>
  fetch(path, { method: "POST" }).then(() => undefined).catch(e => logger.error(e, `[window] ${path}`));
export const minimizeWindow = (): Promise<void> => post("/window/minimize");
export const toggleMaximizeWindow = (): Promise<void> => post("/window/maximize");
export const closeWindow      = (): Promise<void> => post("/window/close");
export async function getWindowFrame(): Promise<{x:number;y:number;width:number;height:number}> {
  const r = await fetch("/window/frame"); return r.json();
}
export async function setWindowFrame(x: number, y: number, width: number, height: number): Promise<void> {
  await fetch("/window/setFrame", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y, width, height }),
  });
}
```

### `src/ui/window/resize.ts` — drag-to-resize handler
Exports `startResize(edge: "n"|"s"|"e"|"w"|"nw"|"ne"|"sw"|"se", e: PointerEvent): void`.
- On pointerdown: capture pointer, snapshot initial frame via `getWindowFrame()`, snapshot initial mouse screenX/screenY.
- On pointermove (throttled to ~16ms via `requestAnimationFrame`): compute new x/y/width/height from the edge identifier and the screen-space delta, clamping width/height to a minimum of 600×400.
- Call `setWindowFrame(...)` with the new frame.
- On pointerup/pointercancel: release pointer capture and stop tracking.
- Use `e.screenX/e.screenY` (not `clientX/clientY`) so coordinates are stable as the window itself moves during the drag.

### `src/ui/render/Titlebar.tsx` — custom titlebar component
- Signal `windowMaximized = signal(false)`; toggled when the maximize button is clicked (we can't subscribe to OS events from the renderer, so just flip the signal optimistically and let the next `getWindowFrame()` reconcile if needed).
- Layout: `<div class="titlebar shrink-0 h-8 flex items-center bg-ffxiv-panel border-b ..." style="border-bottom-color: rgba(200,168,75,0.15)">`.
- Left flex group: 12px padding, 14px diamond SVG, 8px gap, title text.
- Middle: `flex-1` spacer (drag region inherits).
- Right flex group of three `<TitlebarButton>` instances. Each is 46×32, hover styles per the aesthetic spec.
- Render decorative `<span class="absolute top-0 left-0 w-1 h-1 border-t border-l border-ffxiv-gold/40" />` and matching top-right span as the corner accents.

### `src/ui/render/ResizeHandles.tsx` — 8 invisible hit zones
- Render 4 edges (`n`, `s`, `e`, `w`) and 4 corners (`nw`, `ne`, `sw`, `se`).
- add some leeway around edges for easier resizing
- Each has `class="resize-handle resize-edge-n"` etc. and `onPointerDown={(e) => startResize("n", e)}`.
- If `windowMaximized.value` is true, return `null`.

## Documentation Updates

- `docs/WORKFLOW.md` names the custom chrome files and notes that the native frame is suppressed via `titleBarStyle: "hidden"` while keeping `transparent: false` for reliable Windows WebView2 hit-testing.
- `AGENTS.md` should stay in sync with `docs/WORKFLOW.md` whenever custom chrome modules or desktop-window behavior change.
- `openapi.yaml` already documents `/window/*`; update it only if those routes change.

## Verification

1. **Build & type-check**
   ```bash
   bun run build:ui
   bun tsc --noEmit
   ```
2. **Run the desktop app**
   ```bash
   bun run desktop
   ```
3. **Visual checks**
   - Native Windows titlebar is gone; custom titlebar shows at the top with diamond emblem and `FFXIV  GEAR  SETUP` text.
   - Window is opaque for reliable WebView2 hit-testing. On Windows 11, DWM may round the native outer corners; otherwise the app appears intentionally square with no inner/outer corner mismatch.
   - Three control buttons in the top-right; close button glows red on hover.
   - Decorative corner accents visible at the top-left and top-right of the titlebar.
4. **Functional checks**
   - Drag the titlebar (anywhere except buttons) → window moves with the cursor.
   - Click minimize → window minimizes to taskbar.
   - Click maximize → window maximizes; glyph swaps to overlapping-squares; resize handles disappear.
   - Click close → app exits cleanly (window-state.json saves last frame; verify `data/window-state.json` reflects pre-close size on next launch).
   - Drag each of the 8 resize hit zones → window resizes from that edge/corner; cursor matches direction.
   - Resize down to 600×400 minimum; should clamp.
   - Resize and move the window, then close: `data/window-state.json` should contain the final position/size.
5. **No regressions** — Settings button still opens the modal; tabs still switch; gear/inventory loads still work.

## Critical Files (quick reference)

| Action | File | Lines |
|---|---|---|
| Switch to frameless opaque | `src/desktop/index.ts` | 80–86 |
| Request native DWM rounded corners | `src/desktop/index.ts` | after BrowserWindow creation |
| Keep shell square | `public/index.html` | `#app-shell` |
| Mount titlebar + handles | `src/ui/render/App.tsx` | 425–439 |
| Append window-chrome CSS | `src/ui/styles.css` | end |
| Reuse for corner accents | `src/ui/components/Corners.tsx` | whole file |
| Existing backend endpoints | `src/server/routes/window.ts` | whole file |
| WindowControls already wired | `src/desktop/index.ts` | 103–112 |

Reused, not rewritten: the existing `WindowControls` interface (`src/server/ctx.ts:3-9`), the `setWindowControls()` registration (`src/desktop/index.ts:103`), the `Corners` decorative pattern (`src/ui/components/Corners.tsx`), and the FFXIV palette in `tailwind.config.js`.
