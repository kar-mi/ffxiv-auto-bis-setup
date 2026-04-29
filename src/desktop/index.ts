import Electrobun, { BrowserWindow } from "electrobun/bun";
import { dlopen, FFIType } from "bun:ffi";
import path from "path";
import { existsSync, writeFileSync } from "fs";
import { startServer, setWindowControls } from "../server/index.ts";
import type { GearSnapshot, InventorySnapshot } from "../types.ts";

const SERVER_PORT = Number(process.env["PORT"] ?? 3000);

// Enable per-monitor DPI awareness before any window is created.
// bun.exe ships without a DPI-aware manifest, so without this call Windows
// renders the WebView at 96 DPI and then upscales the result — causing blur.
try {
  const shcore = dlopen("shcore", {
    SetProcessDpiAwareness: { args: [FFIType.i32], returns: FFIType.i32 },
  });
  const PROCESS_PER_MONITOR_DPI_AWARE = 2;
  const hr = shcore.symbols.SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);
  if (hr === 0) {
    console.log("[dpi] per-monitor DPI awareness enabled");
  } else {
    // E_ACCESSDENIED (0x80070005) means already set — not an error.
    console.log(`[dpi] SetProcessDpiAwareness result: 0x${(hr >>> 0).toString(16)}`);
  }
} catch (e) {
  console.warn("[dpi] could not set DPI awareness:", e);
}

// Run the HTTP server in-process — we're already in Bun
const projectRoot = findProjectRoot(import.meta.dir);
startServer(SERVER_PORT, path.join(projectRoot, "public"), projectRoot);

// ---------------------------------------------------------------------------
// Window state persistence — saves position/size across restarts
// ---------------------------------------------------------------------------

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

const windowStatePath = path.join(projectRoot, "data", "window-state.json");
const defaultWindowState: WindowState = { x: 0, y: 0, width: 1280, height: 900 };

function loadWindowState(): WindowState {
  try {
    if (existsSync(windowStatePath)) {
      const raw = JSON.parse(Bun.file(windowStatePath).toString()) as unknown;
      if (raw && typeof raw === "object") {
        const s = raw as Record<string, unknown>;
        if (
          typeof s["x"] === "number" &&
          typeof s["y"] === "number" &&
          typeof s["width"] === "number" &&
          typeof s["height"] === "number"
        ) {
          return { x: s["x"], y: s["y"], width: s["width"], height: s["height"] };
        }
      }
    }
  } catch {
    // ignore — fall through to default
  }
  return { ...defaultWindowState };
}

function saveWindowState(state: WindowState): void {
  try {
    writeFileSync(windowStatePath, JSON.stringify(state));
  } catch (e) {
    console.warn("[window-state] Failed to save:", e);
  }
}

const savedState = loadWindowState();

// Open the desktop window
const win = new BrowserWindow({
  title: "FFXIV Gear Setup",
  url: `http://localhost:${SERVER_PORT}`,
  frame: savedState,
  titleBarStyle: "default",
  transparent: false,
});

// Persist window position/size on move or resize (debounced).
// Track last known frame so the close handler doesn't call getFrame() on a
// destroyed window (which returns zeros and wipes the saved state).
let lastKnownFrame: WindowState = { ...savedState };
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWindowStateSave(frame: WindowState): void {
  lastKnownFrame = frame;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveWindowState(lastKnownFrame);
  }, 500);
}

setWindowControls({
  minimize: () => win.minimize(),
  maximize: () => win.maximize(),
  close: () => win.close(),
  getFrame: () => win.getFrame(),
  setFrame: (x, y, width, height) => {
    win.setFrame(x, y, width, height);
    scheduleWindowStateSave({ x, y, width, height });
  },
});

Electrobun.events.on(`resize-${win.id}`, (event: { data: { x: number; y: number; width: number; height: number } }) => {
  scheduleWindowStateSave({ x: event.data.x, y: event.data.y, width: event.data.width, height: event.data.height });
});
Electrobun.events.on(`move-${win.id}`, (event: { data: { x: number; y: number } }) => {
  const f = win.getFrame();
  scheduleWindowStateSave({ x: event.data.x, y: event.data.y, width: f.width, height: f.height });
});

// Flush the last known frame on close (don't call getFrame — window may already be gone).
Electrobun.events.on(`close-${win.id}`, () => {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveWindowState(lastKnownFrame);
});

// -----------------------------------------------------------------------
// Packet capture runs as a child process (not a Web Worker) so that
// native .node addons in @ffxiv-teamcraft/pcap-ffxiv can load correctly.
// -----------------------------------------------------------------------

// Walk up from the compiled file's directory until we find package.json —
// that directory is the project root. Works in both dev and packaged builds
// because the Electrobun build output lives *inside* the project directory.
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`No package.json found above ${startDir}`);
    dir = parent;
  }
}

// injector.node is compiled for Node.js v22 (ABI 127) — must run under node, not bun.
// Build pcap-host.ts → dist/pcap-host.cjs (CJS bundle, externals stay in node_modules).
const pcapCjsPath = path.join(projectRoot, "dist", "pcap-host.cjs");
{
  console.log("[pcap] Building pcap-host.cjs...");
  const build = Bun.spawnSync(
    ["bun", "build", "src/pcap/host.ts",
      "--target=node", "--format=cjs",
      `--outfile=${pcapCjsPath}`,
      "--external=@ffxiv-teamcraft/pcap-ffxiv",
    ],
    { cwd: projectRoot, stdout: "inherit", stderr: "inherit" },
  );
  if (build.exitCode !== 0) throw new Error("pcap-host build failed");
}

const pcapProc = Bun.spawn(["node", pcapCjsPath], {
  stdout: "pipe",
  stderr: "pipe",
  cwd: projectRoot,
  env: { ...process.env, PCAP_REGION: process.env["PCAP_REGION"] ?? "Global" },
});

// Read newline-delimited JSON from the host process
async function readPcapOutput(): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of pcapProc.stdout as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as { type: string; data?: GearSnapshot; message?: string };
        handlePcapMessage(msg);
      } catch {
        console.warn("[pcap-host] Unparseable line:", line);
      }
    }
  }
}

async function readPcapStderr(): Promise<void> {
  const decoder = new TextDecoder();
  for await (const chunk of pcapProc.stderr as unknown as AsyncIterable<Uint8Array>) {
    console.error("[pcap-host:err]", decoder.decode(chunk));
  }
}

function handlePcapMessage(msg: { type: string; data?: GearSnapshot | InventorySnapshot; message?: string }): void {
  switch (msg.type) {
    case "started":
      console.log("[pcap] Capture running — waiting for gear packets (container 1000)");
      break;
    case "stopped":
      console.log("[pcap] Capture stopped");
      break;
    case "gearSnapshot": {
      if (!msg.data) break;
      const snapshot = msg.data as GearSnapshot;
      console.log(`[pcap] Gear snapshot: classId=${snapshot.classId} items=${Object.keys(snapshot.items).length}`);
      fetch(`http://localhost:${SERVER_PORT}/pcap/gear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      }).catch((err) => console.error("[pcap] Failed to post gear snapshot:", err));
      break;
    }
    case "inventorySnapshot": {
      if (!msg.data) break;
      const snapshot = msg.data as InventorySnapshot;
      console.log(`[pcap] Inventory snapshot: ${snapshot.items.length} items`);
      fetch(`http://localhost:${SERVER_PORT}/pcap/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      }).catch((err) => console.error("[pcap] Failed to post inventory snapshot:", err));
      break;
    }
  }
}

// Start reading in the background (don't await — runs for the lifetime of the app)
readPcapOutput().catch((err) => console.error("[pcap-host] stdout read error:", err));
readPcapStderr().catch((err) => console.error("[pcap-host] stderr read error:", err));

// Clean up on exit
process.on("exit", () => pcapProc.kill());
