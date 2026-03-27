/**
 * Standalone packet capture host — run as a child process by the Electrobun main.
 * Outputs newline-delimited JSON to stdout; errors to stderr.
 * Runs as a regular OS process (not a Web Worker) so native .node addons load correctly.
 */

// Redirect all console output to stderr so stdout stays clean for JSON IPC.
// This also captures console.log calls inside @ffxiv-teamcraft/pcap-ffxiv itself.
const _write = (prefix: string, args: unknown[]) =>
  process.stderr.write(prefix + args.map(String).join(" ") + "\n");
console.log   = (...a) => _write("", a);
console.info  = (...a) => _write("[info] ", a);
console.warn  = (...a) => _write("[warn] ", a);
console.error = (...a) => _write("[error] ", a);

import { GearPacketCapture } from "./pcap.ts";
import { loadMateriaData } from "./materia-data.ts";
import { buildMateriaLookup } from "./materia.ts";

// pcap-host is spawned with cwd set to the project root (see bun/index.ts)
const projectRoot = process.cwd();

function send(msg: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

const region = (process.env["PCAP_REGION"] ?? "Global") as "Global" | "CN" | "KR";
const capture = new GearPacketCapture();

capture.on("started", () => {
  send({ type: "started" });
});

capture.on("stopped", () => {
  send({ type: "stopped" });
});

capture.on("error", (err) => {
  process.stderr.write(JSON.stringify({ type: "error", message: String(err) }) + "\n");
});

capture.on("gearSnapshot", (snapshot) => {
  send({ type: "gearSnapshot", data: snapshot });
});

process.on("SIGTERM", () => {
  capture.stop().then(() => process.exit(0));
});

loadMateriaData(projectRoot).then(data => {
  capture.setMateriaLookup(buildMateriaLookup(data));
  console.log(`[materia] Loaded ${data.length} entries`);
  return capture.start(region);
}).catch(err => {
  console.warn('[materia] Failed to load materia data, starting without it:', err);
  void capture.start(region);
});
