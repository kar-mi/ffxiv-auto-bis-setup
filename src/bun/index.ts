import { BrowserWindow } from "electrobun/bun";
import path from "path";
import { existsSync } from "fs";
import { startServer } from "../index.ts";
import type { GearSnapshot } from "../types.ts";

const SERVER_PORT = Number(process.env["PORT"] ?? 3000);

// Run the HTTP server in-process — we're already in Bun
startServer(SERVER_PORT);

// Open the desktop window
new BrowserWindow({
  title: "FFXIV Gear Setup",
  url: `http://localhost:${SERVER_PORT}`,
  width: 1280,
  height: 900,
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

const projectRoot = findProjectRoot(import.meta.dir);

// injector.node is compiled for Node.js v22 (ABI 127) — must run under node, not bun.
// Build pcap-host.ts → dist/pcap-host.cjs (CJS bundle, externals stay in node_modules).
const pcapCjsPath = path.join(projectRoot, "dist", "pcap-host.cjs");
{
  console.log("[pcap] Building pcap-host.cjs...");
  const build = Bun.spawnSync(
    ["bun", "build", "src/pcap-host.ts",
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
  env: { ...process.env, PCAP_REGION: "Global", PCAP_DEBUG: "0" },
});

// Read newline-delimited JSON from the host process
async function readPcapOutput(): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of pcapProc.stdout) {
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
  for await (const chunk of pcapProc.stderr) {
    console.error("[pcap-host:err]", decoder.decode(chunk));
  }
}

function handlePcapMessage(msg: { type: string; data?: GearSnapshot; message?: string }): void {
  switch (msg.type) {
    case "started":
      console.log("[pcap] Capture running — waiting for gear packets (container 1000)");
      break;
    case "stopped":
      console.log("[pcap] Capture stopped");
      break;
    case "gearSnapshot": {
      const snapshot = msg.data!;
      console.log(`[pcap] Gear snapshot: classId=${snapshot.classId} items=${Object.keys(snapshot.items).length}`);
      fetch(`http://localhost:${SERVER_PORT}/pcap/gear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      }).catch((err) => console.error("[pcap] Failed to post snapshot:", err));
      break;
    }
  }
}

// Start reading in the background (don't await — runs for the lifetime of the app)
readPcapOutput().catch((err) => console.error("[pcap-host] stdout read error:", err));
readPcapStderr().catch((err) => console.error("[pcap-host] stderr read error:", err));

// Clean up on exit
process.on("exit", () => pcapProc.kill());
